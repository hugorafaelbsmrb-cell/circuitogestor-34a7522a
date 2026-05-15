import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * ZapSign webhook receiver — public endpoint.
 * ZapSign sends events for: doc_signed, doc_refused, etc.
 * We only react to "doc_signed" — mark contract as signed and attach the
 * authenticated PDF to all related Asaas charges (enables anticipation).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    console.log('ZapSign webhook received:', JSON.stringify(payload).slice(0, 500));

    const eventType = payload.event_type || payload.status;
    const docToken = payload.token || payload.open_id || payload.doc_token;
    const signedFileUrl = payload.signed_file || payload.signed_file_url || null;

    if (!docToken) {
      return json({ ok: true, ignored: 'no token' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the contract by zapsign_document_id
    const { data: contract, error: findErr } = await admin
      .from('contracts')
      .select('id, guardian_id, zapsign_signed_at')
      .eq('zapsign_document_id', docToken)
      .maybeSingle();

    if (findErr || !contract) {
      console.warn('Contract not found for zapsign doc', docToken);
      return json({ ok: true, ignored: 'contract not found' });
    }

    // Update zapsign_status regardless
    const updates: Record<string, unknown> = {
      zapsign_status: eventType || payload.status || 'unknown',
    };

    const isSigned = eventType === 'doc_signed' || payload.status === 'signed';

    if (isSigned && !contract.zapsign_signed_at) {
      updates.zapsign_signed_at = new Date().toISOString();
      updates.zapsign_signed_pdf_url = signedFileUrl;
      updates.signed_at = new Date().toISOString();
      updates.status = 'signed';

      // Log signature event
      await admin.from('contract_signature_logs').insert({
        contract_id: contract.id,
        action: 'signed_zapsign',
        ip_address: payload.signer_ip || null,
        user_agent: 'ZapSign Webhook',
      });
    }

    await admin.from('contracts').update(updates).eq('id', contract.id);

    // Mark enrollment as contract_signed
    if (isSigned) {
      const { data: contractFull } = await admin
        .from('contracts')
        .select('enrollment_id')
        .eq('id', contract.id)
        .maybeSingle();

      if (contractFull?.enrollment_id) {
        await admin
          .from('enrollments')
          .update({ contract_signed_at: new Date().toISOString() })
          .eq('id', contractFull.enrollment_id);
      }

      // Attach signed PDF to Asaas payments (enables anticipation)
      if (signedFileUrl) {
        await attachSignedPdfToAsaas(admin, contract.id, signedFileUrl).catch((e) => {
          console.error('Failed to attach PDF to Asaas:', e);
        });
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error('zapsign-webhook error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});

async function attachSignedPdfToAsaas(
  admin: ReturnType<typeof createClient>,
  contractId: string,
  signedPdfUrl: string,
) {
  // Get Asaas API key + environment
  const { data: keySetting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'ASAAS_API_KEY')
    .maybeSingle();
  const { data: envSetting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'ASAAS_ENVIRONMENT')
    .maybeSingle();

  const apiKey = keySetting?.value?.trim();
  if (!apiKey) {
    console.warn('No Asaas API key — skipping PDF attach');
    return;
  }
  const baseUrl = envSetting?.value === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  // Find Asaas payments tied to this contract
  const { data: payments } = await admin
    .from('payments')
    .select('asaas_payment_id')
    .eq('contract_id', contractId)
    .not('asaas_payment_id', 'is', null);

  if (!payments?.length) {
    console.log('No Asaas payments to attach for contract', contractId);
    return;
  }

  // Download signed PDF
  const pdfResp = await fetch(signedPdfUrl);
  if (!pdfResp.ok) throw new Error(`Failed to download signed PDF: ${pdfResp.status}`);
  const pdfBlob = await pdfResp.blob();

  // Attach to each payment via Asaas /payments/{id}/documents
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
      if (!resp.ok) {
        const txt = await resp.text();
        console.error(`Asaas attach failed for ${p.asaas_payment_id}:`, txt);
      } else {
        console.log(`Attached signed contract to Asaas payment ${p.asaas_payment_id}`);
      }
    } catch (e) {
      console.error(`Error attaching to ${p.asaas_payment_id}:`, e);
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
