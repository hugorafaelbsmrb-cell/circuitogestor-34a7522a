import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Clicksign webhook receiver — public endpoint (no JWT).
 * Eventos relevantes (v3): `auto_close`, `sign`, `refusal`, `cancel`.
 * Quando o envelope é fechado/assinado, baixamos o PDF assinado e anexamos
 * aos pagamentos do Asaas para liberar antecipação.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    console.log('Clicksign webhook:', JSON.stringify(payload).slice(0, 800));

    const event = payload?.event?.name || payload?.event_name || payload?.event;
    const envelopeId =
      payload?.data?.envelope?.id ||
      payload?.envelope?.id ||
      payload?.data?.id ||
      payload?.event?.data?.envelope?.id;

    if (!envelopeId) return json({ ok: true, ignored: 'no envelope id' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: contract } = await admin
      .from('contracts')
      .select('id, enrollment_id, clicksign_signed_at')
      .eq('clicksign_envelope_id', envelopeId)
      .maybeSingle();

    if (!contract) {
      console.warn('Contrato não encontrado para envelope', envelopeId);
      return json({ ok: true, ignored: 'contract not found' });
    }

    const updates: Record<string, unknown> = {
      clicksign_status: event || 'unknown',
    };

    const isClosed = event === 'auto_close' || event === 'close' || event === 'sign';
    if (isClosed && !contract.clicksign_signed_at) {
      updates.clicksign_signed_at = new Date().toISOString();
      updates.signed_at = new Date().toISOString();
      updates.status = 'signed';

      // Buscar PDF assinado
      const signedUrl = await fetchSignedPdfUrl(admin, envelopeId).catch((e) => {
        console.error('Erro ao obter PDF assinado:', e);
        return null;
      });
      if (signedUrl) updates.clicksign_signed_pdf_url = signedUrl;

      await admin.from('contract_signature_logs').insert({
        contract_id: contract.id,
        action: 'signed_clicksign',
        ip_address: null,
        user_agent: 'Clicksign Webhook',
      });

      if (contract.enrollment_id) {
        await admin
          .from('enrollments')
          .update({ contract_signed_at: new Date().toISOString() })
          .eq('id', contract.enrollment_id);
      }

      if (signedUrl) {
        await attachSignedPdfToAsaas(admin, contract.id, signedUrl).catch((e) => {
          console.error('Falha ao anexar PDF no Asaas:', e);
        });
      }
    }

    await admin.from('contracts').update(updates).eq('id', contract.id);
    return json({ ok: true });
  } catch (err) {
    console.error('clicksign-webhook error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500);
  }
});

async function fetchSignedPdfUrl(
  admin: ReturnType<typeof createClient>,
  envelopeId: string,
): Promise<string | null> {
  const [{ data: tokenSetting }, { data: envSetting }] = await Promise.all([
    admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_API_TOKEN').maybeSingle(),
    admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_ENVIRONMENT').maybeSingle(),
  ]);
  const apiToken = tokenSetting?.value?.trim();
  if (!apiToken) return null;
  const apiBase = (envSetting?.value || 'sandbox') === 'production'
    ? 'https://app.clicksign.com/api/v3'
    : 'https://sandbox.clicksign.com/api/v3';

  const r = await fetch(`${apiBase}/envelopes/${envelopeId}/documents`, {
    headers: { Authorization: apiToken, Accept: 'application/vnd.api+json' },
  });
  if (!r.ok) {
    console.error('Falha ao listar documentos:', r.status, await r.text());
    return null;
  }
  const data = await r.json().catch(() => ({}));
  const docs = data?.data || [];
  // Priorizar o "signed" ou retornar o primeiro url disponível
  for (const d of docs) {
    const url = d?.attributes?.signed_url || d?.attributes?.download_url || d?.attributes?.url;
    if (url) return url;
  }
  return null;
}

async function attachSignedPdfToAsaas(
  admin: ReturnType<typeof createClient>,
  contractId: string,
  signedPdfUrl: string,
) {
  const { data: keySetting } = await admin
    .from('app_settings').select('value').eq('key', 'ASAAS_API_KEY').maybeSingle();
  const { data: envSetting } = await admin
    .from('app_settings').select('value').eq('key', 'ASAAS_ENVIRONMENT').maybeSingle();

  const apiKey = keySetting?.value?.trim();
  if (!apiKey) return;
  const baseUrl = envSetting?.value === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  const { data: payments } = await admin
    .from('payments')
    .select('asaas_payment_id')
    .eq('contract_id', contractId)
    .not('asaas_payment_id', 'is', null);
  if (!payments?.length) return;

  const pdfResp = await fetch(signedPdfUrl);
  if (!pdfResp.ok) throw new Error(`download signed PDF: ${pdfResp.status}`);
  const pdfBlob = await pdfResp.blob();

  for (const p of payments) {
    if (!p.asaas_payment_id) continue;
    try {
      const form = new FormData();
      form.append('file', pdfBlob, 'contrato-assinado.pdf');
      form.append('type', 'CONTRACT');
      form.append('availableAfterPayment', 'false');
      const r = await fetch(`${baseUrl}/payments/${p.asaas_payment_id}/documents`, {
        method: 'POST',
        headers: { access_token: apiKey },
        body: form,
      });
      if (!r.ok) console.error(`Asaas attach ${p.asaas_payment_id}:`, await r.text());
    } catch (e) {
      console.error(`Erro anexando ${p.asaas_payment_id}:`, e);
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
