import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ZAPSIGN_API = 'https://api.zapsign.com.br/api/v1';

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
    const { contractId, pdfBase64 } = body as { contractId?: string; pdfBase64?: string };
    if (!contractId || !pdfBase64) {
      return json({ error: 'contractId e pdfBase64 são obrigatórios' }, 400);
    }

    // Service-role client for unrestricted reads/writes
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load ZapSign API token from app_settings
    const { data: tokenSetting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'ZAPSIGN_API_TOKEN')
      .maybeSingle();

    const zapToken = tokenSetting?.value?.trim();
    if (!zapToken) {
      return json({ error: 'Token do ZapSign não configurado em Configurações → Chaves de API' }, 400);
    }

    // Load contract + related data
    const { data: contract, error: contractErr } = await admin
      .from('contracts')
      .select('id, guardian_id, student_id, course_id, total_value, zapsign_document_id')
      .eq('id', contractId)
      .maybeSingle();

    if (contractErr || !contract) {
      return json({ error: 'Contrato não encontrado' }, 404);
    }

    if (contract.zapsign_document_id) {
      // Already sent — return existing sign url
      const { data: existing } = await admin
        .from('contracts')
        .select('zapsign_sign_url')
        .eq('id', contractId)
        .maybeSingle();
      if (existing?.zapsign_sign_url) {
        return json({ signUrl: existing.zapsign_sign_url, alreadySent: true });
      }
    }

    const [{ data: guardian }, { data: student }, { data: course }] = await Promise.all([
      admin.from('guardians').select('name, email, phone, cpf').eq('id', contract.guardian_id).maybeSingle(),
      admin.from('students').select('name').eq('id', contract.student_id).maybeSingle(),
      admin.from('courses').select('name').eq('id', contract.course_id).maybeSingle(),
    ]);

    if (!guardian || !student || !course) {
      return json({ error: 'Dados de contrato incompletos' }, 400);
    }

    // Normalize phone: ZapSign expects country code separate
    const digits = (guardian.phone || '').replace(/\D/g, '');
    let phoneCountry = '55';
    let phoneNumber = digits;
    if (digits.startsWith('55') && digits.length > 11) {
      phoneNumber = digits.slice(2);
    }

    const docName = `Contrato - ${student.name} - ${course.name}`.slice(0, 250);

    // Create document on ZapSign WITHOUT automatic notifications (we send via W-API)
    const zapPayload = {
      name: docName,
      base64_pdf: pdfBase64,
      signers: [
        {
          name: guardian.name,
          email: guardian.email || undefined,
          phone_country: phoneCountry,
          phone_number: phoneNumber,
          auth_mode: 'assinaturaTela',
          send_automatic_email: false,
          send_automatic_whatsapp: false,
        },
      ],
      lang: 'pt-br',
      disable_signer_emails: true,
      brand_primary_color: '',
      external_id: contractId,
    };

    const zapResp = await fetch(`${ZAPSIGN_API}/docs/?api_token=${zapToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zapPayload),
    });

    const zapData = await zapResp.json();
    if (!zapResp.ok) {
      console.error('ZapSign error:', zapData);
      return json({ error: 'Erro ZapSign', details: zapData }, 502);
    }

    const docToken = zapData.token;
    const signer = (zapData.signers || [])[0];
    const signUrl = signer?.sign_url;
    const signerToken = signer?.token;

    if (!docToken || !signUrl) {
      return json({ error: 'Resposta inválida do ZapSign', details: zapData }, 502);
    }

    // Save references on contract
    const { error: updErr } = await admin
      .from('contracts')
      .update({
        zapsign_document_id: docToken,
        zapsign_signer_token: signerToken,
        zapsign_sign_url: signUrl,
        zapsign_status: zapData.status || 'pending',
        zapsign_sent_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    if (updErr) {
      console.error('Failed to update contract:', updErr);
      return json({ error: 'Erro ao salvar referências do ZapSign' }, 500);
    }

    return json({ signUrl, documentId: docToken });
  } catch (err) {
    console.error('zapsign-send error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
