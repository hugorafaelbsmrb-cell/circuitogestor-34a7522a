import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Clicksign envelope creation (sandbox / production)
 * - Creates envelope, uploads PDF, adds signer with ICP-Brasil requirement, activates.
 * - Returns sign URL to be sent via WhatsApp.
 * API v3 docs: https://developers.clicksign.com/docs
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
    const { contractId, pdfBase64: pdfBase64Input, priorSignedPdfUrl } = body as { contractId?: string; pdfBase64?: string; priorSignedPdfUrl?: string };
    if (!contractId || (!pdfBase64Input && !priorSignedPdfUrl)) {
      return json({ error: 'contractId e (pdfBase64 ou priorSignedPdfUrl) são obrigatórios' }, 400);
    }
    let pdfBase64 = pdfBase64Input;
    if (!pdfBase64 && priorSignedPdfUrl) {
      const r = await fetch(priorSignedPdfUrl);
      if (!r.ok) return json({ error: `Falha ao baixar PDF assinado (${r.status})` }, 502);
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      pdfBase64 = btoa(bin);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load API token + environment (default sandbox)
    const [{ data: tokenSetting }, { data: envSetting }] = await Promise.all([
      admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_API_TOKEN').maybeSingle(),
      admin.from('app_settings').select('value').eq('key', 'CLICKSIGN_ENVIRONMENT').maybeSingle(),
    ]);

    const apiToken = tokenSetting?.value?.trim();
    if (!apiToken) {
      return json({ error: 'Token Clicksign não configurado em Configurações → Chaves de API' }, 400);
    }
    const environment = (envSetting?.value || 'sandbox').trim();
    const apiBase = environment === 'production'
      ? 'https://app.clicksign.com/api/v3'
      : 'https://sandbox.clicksign.com/api/v3';
    const signBase = environment === 'production'
      ? 'https://app.clicksign.com/sign'
      : 'https://sandbox.clicksign.com/sign';

    const { data: contract, error: contractErr } = await admin
      .from('contracts')
      .select('id, guardian_id, student_id, course_id, clicksign_envelope_id, clicksign_sign_url')
      .eq('id', contractId)
      .maybeSingle();
    if (contractErr || !contract) return json({ error: 'Contrato não encontrado' }, 404);

    if (contract.clicksign_envelope_id && contract.clicksign_sign_url) {
      return json({ signUrl: contract.clicksign_sign_url, alreadySent: true });
    }

    const [{ data: guardian }, { data: student }, { data: course }] = await Promise.all([
      admin.from('guardians').select('name, email, phone, cpf').eq('id', contract.guardian_id).maybeSingle(),
      admin.from('students').select('name').eq('id', contract.student_id).maybeSingle(),
      admin.from('courses').select('name').eq('id', contract.course_id).maybeSingle(),
    ]);
    if (!guardian || !student || !course) return json({ error: 'Dados de contrato incompletos' }, 400);

    const cpfDigits = (guardian.cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      return json({ error: 'CPF do responsável é obrigatório (11 dígitos) para assinatura ICP-Brasil' }, 400);
    }
    if (!guardian.email) {
      return json({ error: 'E-mail do responsável é obrigatório para Clicksign' }, 400);
    }

    // Normalize phone to E.164 (+55...)
    const phoneDigits = (guardian.phone || '').replace(/\D/g, '');
    const phoneE164 = phoneDigits ? `+${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}` : undefined;

    const envelopeName = `Contrato - ${student.name} - ${course.name}`.slice(0, 250);

    // 1) Create envelope (status: draft)
    const envResp = await csFetch(`${apiBase}/envelopes`, apiToken, {
      data: {
        type: 'envelopes',
        attributes: {
          name: envelopeName,
          locale: 'pt-BR',
          auto_close: true,
          remind_interval: 3,
          block_after_refusal: true,
        },
      },
    });
    if (!envResp.ok) return csError('criar envelope', envResp);
    const envelopeId = envResp.data?.data?.id;
    if (!envelopeId) return json({ error: 'Envelope sem id', details: envResp.data }, 502);

    // 2) Upload document (base64 PDF)
    const docResp = await csFetch(`${apiBase}/envelopes/${envelopeId}/documents`, apiToken, {
      data: {
        type: 'documents',
        attributes: {
          filename: `contrato-${student.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content_base64: `data:application/pdf;base64,${pdfBase64}`,
        },
      },
    });
    if (!docResp.ok) return csError('subir PDF', docResp);
    const documentId = docResp.data?.data?.id;

    // 3) Add signer (with ICP-Brasil prerequisites: full name, CPF, birthday)
    const signerAttrs: Record<string, unknown> = {
      name: guardian.name,
      email: guardian.email,
      has_documentation: true,
      documentation: cpfDigits,
      refusable: true,
      communicate_events: {
        document_signed: 'none',
        signature_request: 'none',
        signature_reminder: 'none',
      },
    };
    if (phoneE164) signerAttrs.phone_number = phoneE164;

    const signerResp = await csFetch(`${apiBase}/envelopes/${envelopeId}/signers`, apiToken, {
      data: { type: 'signers', attributes: signerAttrs },
    });
    if (!signerResp.ok) return csError('adicionar signatário', signerResp);
    const signerId = signerResp.data?.data?.id;
    const requestSignatureKey = signerResp.data?.data?.attributes?.request_signature_key;

    // 4) Requirements: agree (action) + ICP-Brasil auth (provide_evidence)
    const reqs = [
      {
        type: 'requirements',
        attributes: { action: 'agree' },
        relationships: {
          document: { data: { type: 'documents', id: documentId } },
          signer: { data: { type: 'signers', id: signerId } },
        },
      },
      {
        type: 'requirements',
        attributes: { action: 'provide_evidence', auth: 'icp_brasil' },
        relationships: {
          document: { data: { type: 'documents', id: documentId } },
          signer: { data: { type: 'signers', id: signerId } },
        },
      },
    ];
    for (const r of reqs) {
      const rr = await csFetch(`${apiBase}/envelopes/${envelopeId}/requirements`, apiToken, { data: r });
      if (!rr.ok) return csError('definir requisito', rr);
    }

    // 5) Activate envelope (draft -> running)
    const actResp = await csFetch(`${apiBase}/envelopes/${envelopeId}`, apiToken, {
      data: { type: 'envelopes', id: envelopeId, attributes: { status: 'running' } },
    }, 'PATCH');
    if (!actResp.ok) return csError('ativar envelope', actResp);

    const signUrl = requestSignatureKey ? `${signBase}/${requestSignatureKey}` : null;
    if (!signUrl) return json({ error: 'Clicksign não retornou request_signature_key', details: signerResp.data }, 502);

    const { error: updErr } = await admin
      .from('contracts')
      .update({
        clicksign_envelope_id: envelopeId,
        clicksign_document_id: documentId,
        clicksign_signer_id: signerId,
        clicksign_request_signature_key: requestSignatureKey,
        clicksign_sign_url: signUrl,
        clicksign_status: 'running',
        clicksign_sent_at: new Date().toISOString(),
      })
      .eq('id', contractId);
    if (updErr) return json({ error: 'Erro ao salvar referências da Clicksign' }, 500);

    return json({ signUrl, envelopeId, signerId });
  } catch (err) {
    console.error('clicksign-send error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});

async function csFetch(url: string, token: string, body: unknown, method = 'POST') {
  const resp = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: resp.ok, status: resp.status, data };
}

function csError(stage: string, r: { status: number; data: any }) {
  console.error(`Clicksign falhou em ${stage}:`, r.status, JSON.stringify(r.data).slice(0, 500));
  const detail = r.data?.errors
    ? JSON.stringify(r.data.errors).slice(0, 400)
    : JSON.stringify(r.data).slice(0, 400);
  return json({ ok: false, error: `Clicksign (${r.status}) ao ${stage}: ${detail}`, details: r.data }, 200);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
