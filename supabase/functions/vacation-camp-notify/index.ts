import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

function formatCurrency(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function formatDateBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

async function getWapiConfig(supabase: any) {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["W_API_URL", "W_API_TOKEN", "W_API_SESSION"]);
  const cfg: Record<string, string> = {};
  data?.forEach((s: any) => {
    if (s.value) cfg[s.key] = s.value;
  });
  if (!cfg.W_API_URL || !cfg.W_API_TOKEN || !cfg.W_API_SESSION) return null;
  return cfg;
}

async function getSchoolName(supabase: any) {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "system_name")
    .maybeSingle();
  return data?.value || "Nossa Escola";
}

async function sendWhatsAppText(cfg: Record<string, string>, phone: string, message: string) {
  const url = cfg.W_API_URL.replace(/\/$/, "");
  const instanceId = encodeURIComponent(cfg.W_API_SESSION);
  const resp = await fetch(`${url}/v1/message/send-text?instanceId=${instanceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.W_API_TOKEN}`,
    },
    body: JSON.stringify({ phone, message }),
  });
  const ok = resp.ok;
  if (!ok) console.warn("W-API text failed", await resp.text().catch(() => ""));
  return ok;
}

async function sendWhatsAppPixCode(cfg: Record<string, string>, phone: string, pixPayload: string) {
  // Send the pure PIX copy-and-paste code 2s after the main message
  await new Promise((r) => setTimeout(r, 2000));
  return sendWhatsAppText(cfg, phone, pixPayload);
}

async function logMessage(
  supabase: any,
  phone: string,
  preview: string,
  status: "sent" | "error",
  automationKey: string
) {
  await supabase.from("message_logs").insert({
    phone,
    template_category: "vacation_camp",
    message_preview: preview.substring(0, 100),
    automation_key: automationKey,
    status,
    error_message: status === "error" ? "Falha no envio" : null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event, enrollment_id } = await req.json();
    if (!event || !enrollment_id) {
      return new Response(JSON.stringify({ error: "event e enrollment_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: enrollment, error: eErr } = await supabase
      .from("vacation_camp_enrollments")
      .select("*, camp:vacation_camps(name, slug), package:vacation_camp_packages(name, price)")
      .eq("id", enrollment_id)
      .maybeSingle();

    if (eErr || !enrollment) {
      return new Response(JSON.stringify({ error: "Inscrição não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wapi = await getWapiConfig(supabase);
    if (!wapi) {
      console.warn("W-API não configurada — pulando envio");
      return new Response(JSON.stringify({ success: false, skipped: "wapi_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolName = await getSchoolName(supabase);
    const phone = formatPhone(enrollment.guardian_phone);
    const firstName = String(enrollment.guardian_name || "").split(" ")[0] || "responsável";
    const childFirst = String(enrollment.child_name || "").split(" ")[0] || "seu filho(a)";
    const campName = enrollment.camp?.name || "Colônia de Férias";
    const pkgName = enrollment.package?.name || "Pacote";
    const value = formatCurrency(enrollment.amount || enrollment.package?.price || 0);
    const method = enrollment.payment_method;

    if (event === "enrollment_created") {
      const lines: string[] = [
        `Olá, ${firstName}! 🎉`,
        ``,
        `Recebemos a inscrição de *${childFirst}* na *${campName}* — pacote *${pkgName}*.`,
        ``,
        `💰 Valor: *${value}*`,
        `💳 Forma de pagamento: *${method}*`,
      ];

      if (method === "PIX" && enrollment.asaas_pix_payload) {
        lines.push("", "📲 Segue o código PIX *Copia e Cola* logo abaixo:");
      } else if (method === "BOLETO" && enrollment.asaas_bank_slip_url) {
        lines.push("", `🧾 Boleto: ${enrollment.asaas_bank_slip_url}`);
      } else if (method === "CREDIT_CARD" && enrollment.asaas_invoice_url) {
        lines.push("", `💳 Pagar com cartão: ${enrollment.asaas_invoice_url}`);
      }

      if (enrollment.asaas_invoice_url) {
        lines.push(
          "",
          `🔗 Link de pagamento (salve para retomar a qualquer momento): ${enrollment.asaas_invoice_url}`
        );
      }

      lines.push(
        "",
        "Assim que confirmarmos o pagamento, enviamos as orientações da colônia. 💚",
        "",
        `_${schoolName}_`
      );

      const message = lines.join("\n");
      const ok = await sendWhatsAppText(wapi, phone, message);
      await logMessage(supabase, phone, message, ok ? "sent" : "error", "vacation_camp_enrollment");

      if (ok && method === "PIX" && enrollment.asaas_pix_payload) {
        const ok2 = await sendWhatsAppPixCode(wapi, phone, enrollment.asaas_pix_payload);
        await logMessage(
          supabase,
          phone,
          "[PIX] " + enrollment.asaas_pix_payload,
          ok2 ? "sent" : "error",
          "vacation_camp_enrollment_pix"
        );
      }

      return new Response(JSON.stringify({ success: true, sent: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "payment_confirmed") {
      const message = [
        `Oba, ${firstName}! ✅`,
        ``,
        `Confirmamos o pagamento da inscrição de *${childFirst}* na *${campName}* (${pkgName}).`,
        ``,
        `🎒 A vaga está garantida!`,
        `Em breve enviaremos as orientações finais (horários, lista de itens e localização).`,
        ``,
        `Qualquer dúvida, é só chamar por aqui. 💚`,
        ``,
        `_${schoolName}_`,
      ].join("\n");

      const ok = await sendWhatsAppText(wapi, phone, message);
      await logMessage(
        supabase,
        phone,
        message,
        ok ? "sent" : "error",
        "vacation_camp_payment_confirmed"
      );

      return new Response(JSON.stringify({ success: true, sent: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "payment_link") {
      const origin = (req.headers.get("origin") || "").replace(/\/$/, "");
      const baseUrl = origin || "https://circuitogestor.lovable.app";
      const link = `${baseUrl}/colonia-pagamento/${enrollment.id}`;
      const message = [
        `Olá, ${firstName}! 👋`,
        ``,
        `A inscrição de *${childFirst}* na *${campName}* (pacote *${pkgName}*) está reservada.`,
        ``,
        `💰 Valor: *${value}*`,
        ``,
        `Acesse o link abaixo para concluir o pagamento — você pode escolher entre *PIX* ou *Cartão de crédito* (parcelado):`,
        `🔗 ${link}`,
        ``,
        `Qualquer dúvida, é só responder por aqui. 💚`,
        ``,
        `_${schoolName}_`,
      ].join("\n");

      const ok = await sendWhatsAppText(wapi, phone, message);
      await logMessage(supabase, phone, message, ok ? "sent" : "error", "vacation_camp_payment_link");

      return new Response(JSON.stringify({ success: true, sent: ok, link }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (event === "reservation_created") {
      const dateBR = enrollment.reserved_payment_date ? formatDateBR(enrollment.reserved_payment_date) : "";
      const message = [
        `Olá, ${firstName}! 🎉`,
        ``,
        `A vaga de *${childFirst}* na *${campName}* (pacote *${pkgName}*) está *reservada*.`,
        ``,
        `💰 Valor: *${value}*`,
        dateBR ? `📅 Vamos te enviar o *link de pagamento no dia ${dateBR}*, conforme combinado.` : "",
        ``,
        `Se preferir antecipar, é só responder por aqui que enviamos o link na hora. 💚`,
        ``,
        `_${schoolName}_`,
      ].filter(Boolean).join("\n");

      const ok = await sendWhatsAppText(wapi, phone, message);
      await logMessage(supabase, phone, message, ok ? "sent" : "error", "vacation_camp_reservation_created");
      return new Response(JSON.stringify({ success: true, sent: ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    return new Response(JSON.stringify({ error: `Evento desconhecido: ${event}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("vacation-camp-notify error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
