import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ZAPSIGN_API = 'https://api.zapsign.com.br/api/v1';

/**
 * Reconcilia contratos com ZapSign: para cada contrato com
 * zapsign_document_id que ainda não está marcado como assinado,
 * consulta a API do ZapSign e, se o documento já foi assinado,
 * atualiza o registro (mesma lógica do webhook) e anexa o PDF
 * assinado às cobranças do Asaas.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // require admin role
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const { data: tokenSetting } = await admin
      .from('app_settings').select('value').eq('key', 'ZAPSIGN_API_TOKEN').maybeSingle();
    const zapToken = tokenSetting?.value?.trim();
    if (!zapToken) return json({ error: 'ZAPSIGN_API_TOKEN não configurado' }, 400);

    const { data: contracts, error: contractsErr } = await admin
      .from('contracts')
      .select('id, enrollment_id, zapsign_document_id, zapsign_signed_at')
      .not('zapsign_document_id', 'is', null)
      .is('zapsign_signed_at', null);

    if (contractsErr) return json({ error: contractsErr.message }, 500);

    const results: Array<{ id: string; status: string; updated: boolean; error?: string }> = [];

    for (const c of contracts ?? []) {
      try {
        const r = await fetch(`${ZAPSIGN_API}/docs/${c.zapsign_document_id}/`, {
          headers: { Authorization: `Bearer ${zapToken}`, Accept: 'application/json' },
        });
        if (!r.ok) {
          results.push({ id: c.id, status: `http_${r.status}`, updated: false, error: await r.text() });
          continue;
        }
        const doc = await r.json();
        const status = doc?.status || 'unknown';
        const signedFileUrl = doc?.signed_file || null;
        const isSigned = status === 'signed';

        const updates: Record<string, unknown> = { zapsign_status: status };
        if (isSigned) {
          const now = new Date().toISOString();
          updates.zapsign_signed_at = now;
          updates.zapsign_signed_pdf_url = signedFileUrl;
          updates.signed_at = now;
          updates.status = 'signed';
        }

        const { error: upErr } = await admin.from('contracts').update(updates).eq('id', c.id);
        if (upErr) {
          results.push({ id: c.id, status, updated: false, error: upErr.message });
          continue;
        }

        if (isSigned) {
          await admin.from('contract_signature_logs').insert({
            contract_id: c.id,
            action: 'signed_zapsign_sync',
            ip_address: null,
            user_agent: 'ZapSign Sync',
          });
          if (c.enrollment_id) {
            await admin.from('enrollments')
              .update({ contract_signed_at: new Date().toISOString() })
              .eq('id', c.enrollment_id);
          }
          if (signedFileUrl) {
            await attachSignedPdfToAsaas(admin, c.id, signedFileUrl).catch((e) =>
              console.error('attach asaas err', c.id, e)
            );
          }
        }

        results.push({ id: c.id, status, updated: true });
      } catch (e) {
        results.push({ id: c.id, status: 'error', updated: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const signedCount = results.filter(r => r.status === 'signed' && r.updated).length;
    return json({ ok: true, checked: results.length, signedUpdated: signedCount, results });
  } catch (err) {
    console.error('zapsign-sync-all error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500);
  }
});

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
    .from('payments').select('asaas_payment_id')
    .eq('contract_id', contractId).not('asaas_payment_id', 'is', null);
  if (!payments?.length) return;

  const pdfResp = await fetch(signedPdfUrl);
  if (!pdfResp.ok) throw new Error(`download pdf: ${pdfResp.status}`);
  const pdfBlob = await pdfResp.blob();

  for (const p of payments) {
    if (!p.asaas_payment_id) continue;
    try {
      const form = new FormData();
      form.append('file', pdfBlob, 'contrato-assinado.pdf');
      form.append('type', 'CONTRACT');
      form.append('availableAfterPayment', 'false');
      const resp = await fetch(`${baseUrl}/payments/${p.asaas_payment_id}/documents`, {
        method: 'POST',
        headers: { access_token: apiKey },
        body: form,
      });
      if (!resp.ok) console.error(`asaas attach ${p.asaas_payment_id}:`, await resp.text());
    } catch (e) {
      console.error(`attach err ${p.asaas_payment_id}`, e);
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
