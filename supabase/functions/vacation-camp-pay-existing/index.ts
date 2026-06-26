import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(v: string) {
  const d = (v || "").replace(/\D/g, "");
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

const asaasHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  accept: "application/json",
  access_token: apiKey,
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

async function findOrCreateCustomer(cfg: any, p: any) {
  const cleanCpf = (p.cpf || "").replace(/\D/g, "");
  if (cleanCpf) {
    const search = await asaasFetch(
      `${cfg.baseUrl}/customers?cpfCnpj=${cleanCpf}`,
      { method: "GET", headers: asaasHeaders(cfg.apiKey) },
      "searchCustomer",
    );
    if (search?.data?.length) return search.data[0];
  }
  return await asaasFetch(`${cfg.baseUrl}/customers`, {
    method: "POST",
    headers: asaasHeaders(cfg.apiKey),
    body: JSON.stringify({
      name: p.name,
      cpfCnpj: cleanCpf || undefined,
      email: p.email || undefined,
      phone: (p.phone || "").replace(/\D/g, ""),
      notificationDisabled: true,
    }),
  }, "createCustomer");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, enrollment_id } = body;
    if (!enrollment_id) throw new Error("enrollment_id obrigatório");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: enr, error: eErr } = await supabase
      .from("vacation_camp_enrollments")
      .select("*, camp:vacation_camps(name, slug, status), package:vacation_camp_packages(*)")
      .eq("id", enrollment_id)
      .maybeSingle();
    if (eErr || !enr) throw new Error("Inscrição não encontrada");

    const pkg = enr.package;
    if (!pkg) throw new Error("Pacote não encontrado");

    // ---------- INFO ----------
    if (!action || action === "info") {
      return new Response(JSON.stringify({
        enrollment: {
          id: enr.id,
          child_name: enr.child_name,
          guardian_name: enr.guardian_name,
          payment_status: enr.payment_status,
          amount: enr.amount,
          asaas_invoice_url: enr.asaas_invoice_url,
          asaas_pix_payload: enr.asaas_pix_payload,
          payment_method: enr.payment_method,
        },
        camp: { name: enr.camp?.name, slug: enr.camp?.slug },
        package: {
          name: pkg.name,
          price: enr.amount_override ?? enr.amount ?? pkg.price,
          payment_methods: pkg.payment_methods || ["PIX"],
          max_installments: pkg.max_installments || 1,
          card_interest_free_installments: pkg.card_interest_free_installments || 1,
          card_interest_percent: pkg.card_interest_percent || 0,
          due_days: pkg.due_days || 3,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- PAY ----------
    if (action === "pay") {
      if (enr.payment_status === "confirmed") throw new Error("Pagamento já confirmado");

      const method = String(body.payment_method || "PIX").toUpperCase();
      if (!["PIX", "CREDIT_CARD", "BOLETO", "SPLIT"].includes(method)) throw new Error("Forma de pagamento inválida");
      const allowed = (pkg.payment_methods || ["PIX"]).map((m: string) => m.toUpperCase());
      if (method !== "SPLIT" && !allowed.includes(method)) throw new Error("Forma de pagamento não disponível para este pacote");
      if (method === "SPLIT" && !(allowed.includes("PIX") && allowed.includes("CREDIT_CARD"))) {
        throw new Error("Pagamento misto requer PIX e Cartão habilitados no pacote");
      }

      const price = Number(enr.amount_override ?? enr.amount ?? pkg.price);
      const maxInst = Math.max(1, Number(pkg.max_installments) || 1);
      const freeInst = Math.max(1, Number(pkg.card_interest_free_installments) || 1);
      const monthlyPct = Number(pkg.card_interest_percent) || 0;
      const requestedInst = Math.min(maxInst, Math.max(1, Number(body.installments) || 1));

      function calcTotal(p: number, n: number) {
        if (n <= freeInst || monthlyPct <= 0) return p;
        const i = monthlyPct / 100;
        const factor = Math.pow(1 + i, n);
        const pmt = (p * i * factor) / (factor - 1);
        return Math.round(pmt * n * 100) / 100;
      }

      const cfg = await getAsaasConfig(supabase);

      let customerId = enr.asaas_customer_id;
      if (!customerId) {
        const customer = await findOrCreateCustomer(cfg, {
          name: enr.guardian_name,
          cpf: enr.guardian_cpf,
          email: enr.guardian_email,
          phone: enr.guardian_phone,
        });
        customerId = customer.id;
      }

      const due = new Date();
      due.setDate(due.getDate() + (pkg.due_days || 3));
      const dueDate = due.toISOString().slice(0, 10);
      const baseDesc = `Colônia ${enr.camp?.name} - ${pkg.name} - ${enr.child_name}`;

      async function createCharge(billingType: string, value: number, suffix: string, opts?: { installments?: number }) {
        const payload: Record<string, unknown> = {
          customer: customerId,
          billingType,
          dueDate,
          description: suffix ? `${baseDesc} (${suffix === "pix" ? "Parte PIX" : "Parte Cartão"})` : baseDesc,
          externalReference: `camp_${enr.id}${suffix ? `_${suffix}` : ""}`,
          value,
        };
        if (billingType === "CREDIT_CARD" && (opts?.installments || 0) > 1) {
          delete payload.value;
          payload.installmentCount = opts!.installments;
          payload.totalValue = calcTotal(value, opts!.installments!);
        }
        const resp = await asaasFetch(
          `${cfg.baseUrl}/payments`,
          { method: "POST", headers: asaasHeaders(cfg.apiKey), body: JSON.stringify(payload) },
          "createPayment",
        );
        let firstId: string = resp.id;
        let invoiceUrl: string | null = resp.invoiceUrl || null;
        let bankSlipUrl: string | null = resp.bankSlipUrl || null;
        if (!invoiceUrl && resp.id) {
          try {
            const children = await asaasFetch(
              `${cfg.baseUrl}/payments?installment=${resp.id}&limit=1`,
              { method: "GET", headers: asaasHeaders(cfg.apiKey) },
              "getInstallmentPayments",
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
        if (billingType === "PIX") {
          try {
            const pix = await asaasFetch(
              `${cfg.baseUrl}/payments/${firstId}/pixQrCode`,
              { method: "GET", headers: asaasHeaders(cfg.apiKey) },
              "getPix",
            );
            pixPayload = pix.payload || null;
            pixEncodedImage = pix.encodedImage || null;
          } catch (_e) { /* ignore */ }
        }
        return { firstId, invoiceUrl, bankSlipUrl, pixPayload, pixEncodedImage };
      }

      // ----- SPLIT (PIX + CREDIT_CARD) -----
      if (method === "SPLIT") {
        const pixAmount = Math.round(Number(body.pix_amount || 0) * 100) / 100;
        const cardAmount = Math.round((price - pixAmount) * 100) / 100;
        if (!(pixAmount > 0) || !(cardAmount > 0) || pixAmount >= price) {
          throw new Error("Valor do PIX deve ser maior que 0 e menor que o total");
        }

        const pixRes = await createCharge("PIX", pixAmount, "pix");
        const cardRes = await createCharge("CREDIT_CARD", cardAmount, "cc", { installments: requestedInst });

        await supabase
          .from("vacation_camp_enrollments")
          .update({
            asaas_customer_id: customerId,
            asaas_payment_id: pixRes.firstId,
            asaas_payment_id_2: cardRes.firstId,
            asaas_invoice_url: cardRes.invoiceUrl,
            asaas_pix_payload: pixRes.pixPayload,
            payment_method: "SPLIT",
            installments: requestedInst,
            payment_status: "pending",
            split_pix_amount: pixAmount,
            split_card_amount: cardAmount,
            split_pix_paid: false,
            split_card_paid: false,
            guardian_phone: normalizePhone(enr.guardian_phone),
          })
          .eq("id", enr.id);

        return new Response(JSON.stringify({
          success: true,
          split: true,
          pixAmount,
          cardAmount,
          invoiceUrl: cardRes.invoiceUrl,
          bankSlipUrl: cardRes.bankSlipUrl,
          pixPayload: pixRes.pixPayload,
          pixEncodedImage: pixRes.pixEncodedImage,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ----- Single method -----
      const res = await createCharge(method, price, "", { installments: requestedInst });

      await supabase
        .from("vacation_camp_enrollments")
        .update({
          asaas_customer_id: customerId,
          asaas_payment_id: res.firstId,
          asaas_payment_id_2: null,
          asaas_invoice_url: res.invoiceUrl,
          asaas_pix_payload: res.pixPayload,
          payment_method: method,
          installments: requestedInst,
          payment_status: "pending",
          split_pix_amount: null,
          split_card_amount: null,
          split_pix_paid: false,
          split_card_paid: false,
          guardian_phone: normalizePhone(enr.guardian_phone),
        })
        .eq("id", enr.id);

      return new Response(JSON.stringify({
        success: true,
        invoiceUrl: res.invoiceUrl,
        bankSlipUrl: res.bankSlipUrl,
        pixPayload: res.pixPayload,
        pixEncodedImage: res.pixEncodedImage,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Ação inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("vacation-camp-pay-existing error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
