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
  // search
  const search = await asaasFetch(
    `${cfg.baseUrl}/customers?cpfCnpj=${cleanCpf}`,
    { method: "GET", headers: headers(cfg.apiKey) },
    "searchCustomer"
  );
  if (search?.data?.length) return search.data[0];
  // create
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
  const map: Record<string, string> = { PIX: "PIX", BOLETO: "BOLETO", CREDIT_CARD: "CREDIT_CARD" };
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
    } = body;

    // Basic validation
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

    // Load camp + package
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

    const allowedMethods: string[] = pkg.payment_methods || ["PIX"];
    const billingType = getPaymentMethodAsaas(payment_method || "PIX");
    if (!allowedMethods.map((m: string) => m.toUpperCase()).includes(billingType)) {
      throw new Error("Forma de pagamento não disponível para este pacote");
    }

    const normalizedPhone = normalizePhone(guardian_phone);

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
        installments: installments || 1,
        amount: Number(pkg.price),
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Asaas setup
    const cfg = await getAsaasConfig(supabase);
    const customer = await findOrCreateCustomer(cfg, {
      name: guardian_name,
      cpf: guardian_cpf,
      email: guardian_email,
      phone: normalizedPhone,
    });

    // Due date: today + due_days (UTC-3)
    const due = new Date();
    due.setDate(due.getDate() + (pkg.due_days || 3));
    const dueDate = due.toISOString().slice(0, 10);

    const description = `Colônia ${camp.name} - ${pkg.name} - ${child_name}`;
    const externalReference = `camp_${enrollment.id}`;

    const paymentPayload: Record<string, unknown> = {
      customer: customer.id,
      billingType,
      value: Number(pkg.price),
      dueDate,
      description,
      externalReference,
    };

    if (billingType === "CREDIT_CARD" && installments && installments > 1) {
      paymentPayload.installmentCount = installments;
      paymentPayload.installmentValue = Math.round((Number(pkg.price) / installments) * 100) / 100;
    }

    const paymentResp = await asaasFetch(
      `${cfg.baseUrl}/payments`,
      { method: "POST", headers: headers(cfg.apiKey), body: JSON.stringify(paymentPayload) },
      "createPayment"
    );

    let pixPayload: string | null = null;
    let pixEncodedImage: string | null = null;
    if (billingType === "PIX") {
      try {
        const pix = await asaasFetch(
          `${cfg.baseUrl}/payments/${paymentResp.id}/pixQrCode`,
          { method: "GET", headers: headers(cfg.apiKey) },
          "getPix"
        );
        pixPayload = pix.payload || null;
        pixEncodedImage = pix.encodedImage || null;
      } catch (e) {
        console.warn("PIX QR error:", e);
      }
    }

    // Update enrollment with Asaas info
    await supabase
      .from("vacation_camp_enrollments")
      .update({
        asaas_customer_id: customer.id,
        asaas_payment_id: paymentResp.id,
        asaas_invoice_url: paymentResp.invoiceUrl,
        asaas_bank_slip_url: paymentResp.bankSlipUrl,
        asaas_pix_payload: pixPayload,
      })
      .eq("id", enrollment.id);

    return new Response(
      JSON.stringify({
        success: true,
        enrollment_id: enrollment.id,
        payment: {
          id: paymentResp.id,
          billingType,
          value: Number(pkg.price),
          dueDate,
          invoiceUrl: paymentResp.invoiceUrl,
          bankSlipUrl: paymentResp.bankSlipUrl,
          pixPayload,
          pixEncodedImage,
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
