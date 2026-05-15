import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Returns a FRESH signed PDF URL for a ZapSign document.
 * The stored zapsign_signed_pdf_url is a presigned URL that expires (~24h),
 * so we always re-fetch it from ZapSign API on demand.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { contractId } = body as { contractId?: string };
    if (!contractId) return json({ error: 'contractId é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokenSetting } = await admin
      .from('app_settings').select('value').eq('key', 'ZAPSIGN_API_TOKEN').maybeSingle();
    const zapToken = tokenSetting?.value?.trim();
    if (!zapToken) return json({ error: 'Token ZapSign não configurado' }, 400);

    const { data: contract } = await admin
      .from('contracts')
      .select('zapsign_document_id')
      .eq('id', contractId)
      .maybeSingle();

    if (!contract?.zapsign_document_id) {
      return json({ error: 'Contrato sem documento ZapSign vinculado' }, 404);
    }

    const r = await fetch(`https://api.zapsign.com.br/api/v1/docs/${contract.zapsign_document_id}/`, {
      headers: { Authorization: `Bearer ${zapToken}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json({ error: `ZapSign (${r.status}): ${JSON.stringify(data).slice(0, 300)}` }, 200);
    }

    const signedUrl = data.signed_file || data.original_file;
    if (!signedUrl) return json({ error: 'PDF assinado ainda não disponível' }, 404);

    // Update cache (best-effort)
    await admin.from('contracts').update({ zapsign_signed_pdf_url: signedUrl }).eq('id', contractId);

    return json({ url: signedUrl });
  } catch (err) {
    console.error('zapsign-get-pdf error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
