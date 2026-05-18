import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Retorna URL fresca do PDF assinado de um contrato via Clicksign.
 * URLs assinadas pelo Clicksign costumam expirar — sempre buscar via API.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { contractId } = body as { contractId?: string };
    if (!contractId) return json({ error: 'contractId é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const [{ data: tokenSetting }, { data: envSetting }] = await Promise.all([
      admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_API_TOKEN').maybeSingle(),
      admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_ENVIRONMENT').maybeSingle(),
    ]);
    const apiToken = tokenSetting?.value?.trim();
    if (!apiToken) return json({ error: 'Token Clicksign não configurado' }, 400);
    const apiBase = (envSetting?.value || 'sandbox') === 'production'
      ? 'https://app.clicksign.com/api/v3'
      : 'https://sandbox.clicksign.com/api/v3';

    const { data: contract } = await admin
      .from('contracts')
      .select('clicksign_envelope_id')
      .eq('id', contractId)
      .maybeSingle();
    if (!contract?.clicksign_envelope_id) {
      return json({ error: 'Contrato sem envelope Clicksign vinculado' }, 404);
    }

    const r = await fetch(`${apiBase}/envelopes/${contract.clicksign_envelope_id}/documents`, {
      headers: { Authorization: apiToken, Accept: 'application/vnd.api+json' },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: `Clicksign (${r.status}): ${JSON.stringify(data).slice(0, 300)}` }, 200);

    let signedUrl: string | null = null;
    for (const d of (data?.data || [])) {
      signedUrl = d?.attributes?.signed_url || d?.attributes?.download_url || d?.attributes?.url || null;
      if (signedUrl) break;
    }
    if (!signedUrl) return json({ error: 'PDF assinado ainda não disponível' }, 404);

    await admin.from('contracts').update({ clicksign_signed_pdf_url: signedUrl }).eq('id', contractId);
    return json({ url: signedUrl });
  } catch (err) {
    console.error('clicksign-get-pdf error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
