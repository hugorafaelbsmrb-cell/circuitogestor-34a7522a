import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  return `55${d}`;
}

async function getAsaasConfig(supabase: any) {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"]);
  const apiKey = data?.find((s: any) => s.key === "ASAAS_API_KEY")?.value;
  const env = data?.find((s: any) => s.key === "ASAAS_ENVIRONMENT")?.value || "sandbox";
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  const baseUrl = env === "production" ? "https://www.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";
  return { apiKey, baseUrl };
}

const headers = (apiKey: string) => ({
  "Content-Type": "application/json",
  "accept": "application/json",
  "access_token": apiKey,
  "user-agent": "Lovable/1.0",
});

async function asaasFetch(url: string, opts: RequestInit, op: string) {
  const r = await fetch(url, opts);
  const text = await r.text();
  if (text.startsWith("<")) throw new Error(`Erro Asaas ${op}: resposta HTML (chave inválida?)`);
  const j = JSON.parse(text);
  if (!r.ok) throw new Error(j.errors?.[0]?.description || j.message || `Erro Asaas ${op}`);
  return j;
}

async function findOrCreateCustomer(cfg: any, payload: any) {
  const cleanCpf = payload.cpf.replace(/\D/g, "");
  const search = await asaasFetch(
    `${cfg.baseUrl}/customers?cpfCnpj=${cleanCpf}`,
    { method: "GET", headers: headers(cfg.apiKey) },
    "searchCustomer"
  );
  if (search?.data?.length) return search.data[0];
  return await asaasFetch(`${cfg.baseUrl}/customers`, {
    method: "POST",
    headers: headers(cfg.apiKey),
    body: JSON.stringify({
      name: payload.name,
      cpfCnpj: cleanCpf,
      email: payload.email || undefined,
      phone: payload.phone.replace(/\D/g, ""),
      notificationDisabled: true,
    }),
  }, "createCustomer");
}

function getPaymentMethodAsaas(m: string) {
  const map: Record<string, string> = { PIX: "PIX", BOLETO: "BOLETO", CREDIT_CARD: "CREDIT_CARD", SPLIT: "SPLIT", RESERVE: "RESERVE" };
  return map[m] || "PIX";
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      camp_slug,
      package_id,
      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_cpf,
      child_name,
      child_age,
      child_birthdate,
      payment_method,
      installments,
      notes,
      pix_amount,
      reserved_payment_date,
    } = body;


    if (!camp_slug || !package_id || !guardian_name || !guardian_phone || !guardian_cpf || !child_name) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidCPF(guardian_cpf)) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: camp, error: campErr } = await supabase
      .from("vacation_camps")
      .select("id, name, status")
      .eq("slug", camp_slug)
      .maybeSingle();
    if (campErr || !camp) throw new Error("Colônia não encontrada");
    if (camp.status !== "published") throw new Error("Inscrições não disponíveis para esta colônia");

    const { data: pkg, error: pkgErr } = await supabase
      .from("vacation_camp_packages")
      .select("*")
      .eq("id", package_id)
      .eq("camp_id", camp.id)
      .maybeSingle();
    if (pkgErr || !pkg) throw new Error("Pacote não encontrado");
    if (!pkg.active) throw new Error("Pacote indisponível");
    if (pkg.max_slots && pkg.sold_count >= pkg.max_slots) throw new Error("Pacote esgotado");

    const allowedMethods: string[] = (pkg.payment_methods || ["PIX"]).map((m: string) => m.toUpperCase());
    const billingType = getPaymentMethodAsaas(payment_method || "PIX");
    if (billingType === "SPLIT") {
      if (!(allowedMethods.includes("PIX") && allowedMethods.includes("CREDIT_CARD"))) {
        throw new Error("Pagamento misto requer PIX e Cartão habilitados no pacote");
      }
    } else if (!allowedMethods.includes(billingType)) {
      throw new Error("Forma de pagamento não disponível para este pacote");
    }

    const normalizedPhone = normalizePhone(guardian_phone);
    const price = Number(pkg.price);
    const maxInst = Math.max(1, Number(pkg.max_installments) || 1);
    const freeInst = Math.max(1, Number(pkg.card_interest_free_installments) || 1);
    const monthlyPct = Number(pkg.card_interest_percent) || 0;
    const requestedInst = Math.min(maxInst, Math.max(1, Number(installments) || 1));

    function calcTotal(p: number, n: number) {
      if (n <= freeInst || monthlyPct <= 0) return p;
      const i = monthlyPct / 100;
      const factor = Math.pow(1 + i, n);
      const pmt = (p * i * factor) / (factor - 1);
      return Math.round(pmt * n * 100) / 100;
    }

    // Insert enrollment as pending
    const { data: enrollment, error: insErr } = await supabase
      .from("vacation_camp_enrollments")
      .insert({
        camp_id: camp.id,
        package_id: pkg.id,
        guardian_name,
        guardian_phone: normalizedPhone,
        guardian_email: guardian_email || null,
        guardian_cpf: guardian_cpf.replace(/\D/g, ""),
        child_name,
        child_age: child_age ? parseInt(String(child_age)) : null,
        child_birthdate: child_birthdate || null,
        notes: notes || null,
        source: "landing",
        payment_status: "pending",
        payment_method: billingType,
        installments: requestedInst,
        amount: price,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const cfg = await getAsaasConfig(supabase);
    const customer = await findOrCreateCustomer(cfg, {
      name: guardian_name,
      cpf: guardian_cpf,
      email: guardian_email,
      phone: normalizedPhone,
    });

    const due = new Date();
    due.setDate(due.getDate() + (pkg.due_days || 3));
    const dueDate = due.toISOString().slice(0, 10);
    const baseDesc = `Colônia ${camp.name} - ${pkg.name} - ${child_name}`;

    async function createCharge(billing: string, value: number, suffix: string, opts?: { installments?: number }) {
      const payload: Record<string, unknown> = {
        customer: customer.id,
        billingType: billing,
        dueDate,
        description: suffix ? `${baseDesc} (${suffix === "pix" ? "Parte PIX" : "Parte Cartão"})` : baseDesc,
        externalReference: `camp_${enrollment.id}${suffix ? `_${suffix}` : ""}`,
        value,
      };
      if (billing === "CREDIT_CARD" && (opts?.installments || 0) > 1) {
        delete payload.value;
        payload.installmentCount = opts!.installments;
        payload.totalValue = calcTotal(value, opts!.installments!);
      }
      const resp = await asaasFetch(
        `${cfg.baseUrl}/payments`,
        { method: "POST", headers: headers(cfg.apiKey), body: JSON.stringify(payload) },
        "createPayment"
      );
      let firstId: string = resp.id;
      let invoiceUrl: string | null = resp.invoiceUrl || null;
      let bankSlipUrl: string | null = resp.bankSlipUrl || null;
      if (!invoiceUrl && resp.id) {
        try {
          const children = await asaasFetch(
            `${cfg.baseUrl}/payments?installment=${resp.id}&limit=1`,
            { method: "GET", headers: headers(cfg.apiKey) },
            "getInstallmentPayments"
          );
          const first = children?.data?.[0];
          if (first) {
            firstId = first.id;
            invoiceUrl = first.invoiceUrl || null;
            bankSlipUrl = first.bankSlipUrl || null;
          }
        } catch (_e) { /* ignore */ }
      }
      let pixPayload: string | null = null;
      let pixEncodedImage: string | null = null;
      if (billing === "PIX") {
        try {
          const pix = await asaasFetch(
            `${cfg.baseUrl}/payments/${firstId}/pixQrCode`,
            { method: "GET", headers: headers(cfg.apiKey) },
            "getPix"
          );
          pixPayload = pix.payload || null;
          pixEncodedImage = pix.encodedImage || null;
        } catch (_e) { /* ignore */ }
      }
      return { firstId, invoiceUrl, bankSlipUrl, pixPayload, pixEncodedImage };
    }

    // ----- SPLIT (PIX + CREDIT_CARD) -----
    if (billingType === "SPLIT") {
      const pixAmount = Math.round(Number(pix_amount || 0) * 100) / 100;
      const cardAmount = Math.round((price - pixAmount) * 100) / 100;
      if (!(pixAmount > 0) || !(cardAmount > 0) || pixAmount >= price) {
        throw new Error("Valor do PIX deve ser maior que 0 e menor que o total");
      }

      const pixRes = await createCharge("PIX", pixAmount, "pix");
      const cardRes = await createCharge("CREDIT_CARD", cardAmount, "cc", { installments: requestedInst });

      await supabase
        .from("vacation_camp_enrollments")
        .update({
          asaas_customer_id: customer.id,
          asaas_payment_id: pixRes.firstId,
          asaas_payment_id_2: cardRes.firstId,
          asaas_invoice_url: cardRes.invoiceUrl,
          asaas_pix_payload: pixRes.pixPayload,
          split_pix_amount: pixAmount,
          split_card_amount: cardAmount,
          split_pix_paid: false,
          split_card_paid: false,
        })
        .eq("id", enrollment.id);

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/vacation-camp-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            apikey: SERVICE_ROLE,
          },
          body: JSON.stringify({ event: "enrollment_created", enrollment_id: enrollment.id }),
        });
      } catch (_e) { /* ignore */ }

      return new Response(JSON.stringify({
        success: true,
        enrollment_id: enrollment.id,
        split: true,
        payment: {
          split: true,
          pixAmount,
          cardAmount,
          invoiceUrl: cardRes.invoiceUrl,
          bankSlipUrl: cardRes.bankSlipUrl,
          pixPayload: pixRes.pixPayload,
          pixEncodedImage: pixRes.pixEncodedImage,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // ----- Single method -----
    const single = await createCharge(billingType, price, "", { installments: requestedInst });

    await supabase
      .from("vacation_camp_enrollments")
      .update({
        asaas_customer_id: customer.id,
        asaas_payment_id: single.firstId,
        asaas_invoice_url: single.invoiceUrl,
        asaas_bank_slip_url: single.bankSlipUrl,
        asaas_pix_payload: single.pixPayload,
      })
      .eq("id", enrollment.id);

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/vacation-camp-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
        body: JSON.stringify({ event: "enrollment_created", enrollment_id: enrollment.id }),
      });
    } catch (notifyErr) {
      console.warn("notify enrollment_created failed:", notifyErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        enrollment_id: enrollment.id,
        payment: {
          id: single.firstId,
          billingType,
          value: price,
          dueDate,
          invoiceUrl: single.invoiceUrl,
          bankSlipUrl: single.bankSlipUrl,
          pixPayload: single.pixPayload,
          pixEncodedImage: single.pixEncodedImage,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
