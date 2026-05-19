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
    const { contractId, pdfBase64 } = body as { contractId?: string; pdfBase64?: string };
    if (!contractId || !pdfBase64) {
      return json({ error: 'contractId e pdfBase64 são obrigatórios' }, 400);
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

    const { data: contract, error: contractErr } = await admin
      .from('contracts')
      .select('id, guardian_id, student_id, course_id, clicksign_envelope_id, clicksign_sign_url')
      .eq('id', contractId)
      .maybeSingle();
    if (contractErr || !contract) return json({ error: 'Contrato não encontrado' }, 404);

    if (contract.clicksign_envelope_id) {
      return json({ ok: true, alreadySent: true, signUrl: null, envelopeId: contract.clicksign_envelope_id, message: 'Envelope já criado na Clicksign.' });
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

    // Clicksign phone_number: only digits, DDD + number (e.g. "11999999999")
    let phoneFormatted: string | undefined;
    const rawPhoneDigits = (guardian.phone || '').replace(/\D/g, '');
    const localDigits = rawPhoneDigits.startsWith('55') ? rawPhoneDigits.slice(2) : rawPhoneDigits;
    if (localDigits.length === 10 || localDigits.length === 11) {
      phoneFormatted = localDigits;
    }

    // Format CPF as 000.000.000-00 (Clicksign requires masked documentation)
    const cpfFormatted = `${cpfDigits.slice(0,3)}.${cpfDigits.slice(3,6)}.${cpfDigits.slice(6,9)}-${cpfDigits.slice(9,11)}`;

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
    // Quando o responsável tem telefone, pedimos que a Clicksign entregue o
    // link de assinatura diretamente via WhatsApp (signature_request:'whatsapp').
    // É a única forma na API v3 de obter um link público de assinatura — o
    // signatário recebe a mensagem do número oficial da Clicksign.
    // Sem telefone, caímos no padrão email.
    const deliveryChannel: 'whatsapp' | 'email' = phoneFormatted ? 'whatsapp' : 'email';
    const signerAttrs: Record<string, unknown> = {
      name: guardian.name,
      email: guardian.email,
      has_documentation: true,
      documentation: cpfFormatted,
      refusable: true,
      communicate_events: {
        // signature_reminder só aceita 'email' ou 'none'
        document_signed: deliveryChannel,
        signature_request: deliveryChannel,
        signature_reminder: 'email',
      },
    };
    if (phoneFormatted) signerAttrs.phone_number = phoneFormatted;

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
        attributes: { action: 'agree', role: 'sign' },
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

    // 6) Trigger Clicksign notification (Clicksign envia email com o link
    //    de assinatura ICP-Brasil — na API v3 não é exposta uma URL pública
    //    de assinatura; o link é entregue exclusivamente pelos canais
    //    configurados em communicate_events do signer).
    const notifResp = await csFetch(
      `${apiBase}/envelopes/${envelopeId}/notifications`,
      apiToken,
      { data: { type: 'notifications', attributes: {} } },
    );
    if (!notifResp.ok) {
      console.warn('Clicksign notification falhou (envelope já ativo):', notifResp.status, JSON.stringify(notifResp.data).slice(0, 300));
    }

    const { error: updErr } = await admin
      .from('contracts')
      .update({
        clicksign_envelope_id: envelopeId,
        clicksign_document_id: documentId,
        clicksign_signer_id: signerId,
        clicksign_request_signature_key: requestSignatureKey ?? null,
        clicksign_sign_url: null,
        clicksign_status: 'running',
        clicksign_sent_at: new Date().toISOString(),
      })
      .eq('id', contractId);
    if (updErr) return json({ error: 'Erro ao salvar referências da Clicksign' }, 500);

    return json({
      ok: true,
      envelopeId,
      signerId,
      signerEmail: guardian.email,
      // signUrl é null por design na API v3 — o link vai por email Clicksign.
      signUrl: null,
      emailSent: notifResp.ok,
      message: 'Envelope ativado. A Clicksign enviará o link de assinatura ICP-Brasil por e-mail.',
    });
  } catch (err) {
    console.error('clicksign-send error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});

async function csFetch(url: string, token: string, body: unknown, method = 'POST') {
  // Retry para 429 (rate limit) e 5xx — curto para caber no wall-time do edge function
  const maxAttempts = 4;
  let lastResp: Response | null = null;
  let lastText = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });
    lastResp = resp;
    lastText = await resp.text();

    if (resp.status !== 429 && resp.status < 500) break;
    if (attempt === maxAttempts) break;

    const retryAfter = parseFloat(resp.headers.get('retry-after') || '');
    // Backoff curto: 1s, 3s, 6s
    const backoff = [1000, 3000, 6000][attempt - 1] ?? 6000;
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 6000)
      : backoff;
    console.warn(`Clicksign ${resp.status} em ${url} — tentativa ${attempt}/${maxAttempts}, aguardando ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  let data: any;
  try { data = JSON.parse(lastText); } catch { data = { raw: lastText }; }
  return { ok: lastResp!.ok, status: lastResp!.status, data };
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
