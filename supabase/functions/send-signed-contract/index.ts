import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  contractId: string;
}

interface ContractContent {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  guardianName: string;
  guardianCpf: string;
  studentName: string;
  courseName: string;
  totalValue: number;
  installments: number;
  signatureImage?: string | null;
  signedAt?: string | null;
  signatureHash?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contractId } = await req.json() as RequestBody;

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contract with related data
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select(`
        *,
        student:students(name, birth_date),
        guardian:guardians(name, phone, cpf, address),
        course:courses(name, duration, price),
        enrollment:enrollments(
          class_group:class_groups(
            name,
            schedule:schedules(day_of_week, start_time, end_time)
          )
        )
      `)
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('Contract not found:', contractError);
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contract.signed_at) {
      return new Response(
        JSON.stringify({ error: 'Contract is not signed yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API configuration and contract config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION', 'whatsapp_template_contract_signed']);

    const { data: contractConfig } = await supabase
      .from('contract_config')
      .select('*')
      .limit(1)
      .single();

    const getSettingValue = (key: string) => settings?.find(s => s.key === key)?.value || '';
    
    const wapiUrl = getSettingValue('W_API_URL') || 'https://api.w-api.app';
    const wapiToken = getSettingValue('W_API_TOKEN');
    const wapiInstanceId = getSettingValue('W_API_SESSION');
    const template = getSettingValue('whatsapp_template_contract_signed') || 
      'Olá {nome}! 🎉\n\nO contrato de matrícula de *{aluno}* no curso *{curso}* foi assinado com sucesso!\n\n✅ *Data da assinatura:* {data_assinatura}\n📄 *Hash de verificação:* {hash}\n\nO documento em PDF está anexado a esta mensagem.\n\nAgradecemos pela confiança! 🙂';

    if (!wapiToken || !wapiInstanceId) {
      console.error('W-API not configured - Token:', !!wapiToken, 'InstanceId:', !!wapiInstanceId);
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured', details: { hasToken: !!wapiToken, hasInstance: !!wapiInstanceId } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    const phone = contract.guardian?.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Guardian phone not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

    // Format date
    const signedDate = new Date(contract.signed_at);
    const formattedDate = signedDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Get first name
    const guardianFirstName = contract.guardian?.name?.split(' ')[0] || 'Responsável';

    // Replace template variables
    let message = template
      .replace(/{nome}/g, guardianFirstName)
      .replace(/{nome_responsavel}/g, guardianFirstName)
      .replace(/{aluno}/g, contract.student?.name || 'Aluno')
      .replace(/{nome_aluno}/g, contract.student?.name || 'Aluno')
      .replace(/{curso}/g, contract.course?.name || 'Curso')
      .replace(/{nome_curso}/g, contract.course?.name || 'Curso')
      .replace(/{data_assinatura}/g, formattedDate)
      .replace(/{hash}/g, contract.signature_hash?.substring(0, 16) + '...' || 'N/A')
      .replace(/\\n/g, '\n');

    // Generate PDF using jsPDF via CDN
    const pdfBase64 = await generateContractPDF({
      schoolName: contractConfig?.school_name || 'Circuito Kids',
      schoolCnpj: contractConfig?.school_cnpj || '',
      schoolAddress: contractConfig?.school_address || '',
      guardianName: contract.guardian?.name || '',
      guardianCpf: contract.guardian?.cpf || '',
      studentName: contract.student?.name || '',
      courseName: contract.course?.name || '',
      totalValue: contract.total_value || 0,
      installments: contract.installment_count || 1,
      signatureImage: contract.signature_image,
      signedAt: contract.signed_at,
      signatureHash: contract.signature_hash,
    });

    // Save message to database first
    const { data: messageRecord, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: formattedPhone,
        message,
        direction: 'outgoing',
        guardian_id: contract.guardian_id,
        status: 'pending',
        media_type: 'document',
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
    }

    // Send PDF document via W-API
    const studentNameSafe = (contract.student?.name || 'contrato').replace(/\s+/g, '_').substring(0, 30);
    const fileName = `Contrato_${studentNameSafe}.pdf`;
    
    const sendResponse = await fetch(
      `${wapiUrl}/v1/message/send-document?instanceId=${wapiInstanceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wapiToken}`,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          document: `data:application/pdf;base64,${pdfBase64}`,
          fileName: fileName,
          caption: message,
        }),
      }
    );

    const sendResult = await sendResponse.json();
    console.log('W-API document response:', sendResult);

    // Update message status
    if (messageRecord) {
      await supabase
        .from('whatsapp_messages')
        .update({
          status: sendResponse.ok ? 'sent' : 'failed',
          wapi_message_id: sendResult?.id || sendResult?.messageId || null,
        })
        .eq('id', messageRecord.id);
    }

    // Log the message
    await supabase.from('message_logs').insert({
      phone: formattedPhone,
      guardian_id: contract.guardian_id,
      message_preview: `[PDF] ${message.substring(0, 80)}`,
      status: sendResponse.ok ? 'sent' : 'failed',
      automation_key: 'auto_contract_signed_notify',
      template_category: 'contract_signed',
    });

    if (!sendResponse.ok) {
      console.error('W-API error:', sendResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send document', details: sendResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sendResult?.id || sendResult?.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simplified PDF generation for edge function (text-based contract summary)
async function generateContractPDF(content: ContractContent): Promise<string> {
  // Since jsPDF doesn't work well in Deno edge functions,
  // we'll create a simple text-based PDF using a minimal approach
  
  const signedDateStr = content.signedAt 
    ? new Date(content.signedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('pt-BR');

  // Create a simple PDF structure
  // Using a basic PDF text template that can be generated without external libs
  const pdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 6 0 R >>
stream
BT
/F1 16 Tf
50 750 Td
(CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS) Tj
/F1 12 Tf
0 -30 Td
(${escapeText(content.schoolName)}) Tj
0 -25 Td
(CNPJ: ${escapeText(content.schoolCnpj)}) Tj
0 -20 Td
(${escapeText(content.schoolAddress)}) Tj
0 -35 Td
/F1 11 Tf
(CONTRATANTE: ${escapeText(content.guardianName)}) Tj
0 -18 Td
(CPF: ${escapeText(content.guardianCpf)}) Tj
0 -30 Td
(ALUNO\\(A\\): ${escapeText(content.studentName)}) Tj
0 -18 Td
(CURSO: ${escapeText(content.courseName)}) Tj
0 -18 Td
(VALOR TOTAL: R$ ${content.totalValue.toFixed(2).replace('.', ',')}) Tj
0 -18 Td
(PARCELAS: ${content.installments}x de R$ ${(content.totalValue / content.installments).toFixed(2).replace('.', ',')}) Tj
0 -40 Td
/F1 10 Tf
(ASSINATURA DIGITAL) Tj
0 -18 Td
(Data: ${escapeText(signedDateStr)}) Tj
0 -18 Td
(Hash de Verificacao: ${escapeText(content.signatureHash?.substring(0, 32) || 'N/A')}...) Tj
0 -30 Td
/F1 8 Tf
(Documento assinado eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
${getPDFStreamLength(content, signedDateStr)}
endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
startxref
%%EOF
`.trim();

  // Convert to base64
  const encoder = new TextEncoder();
  const pdfBytes = encoder.encode(pdfContent);
  return btoa(String.fromCharCode(...pdfBytes));
}

function escapeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ÁÀÂÃ]/g, 'A')
    .replace(/[ÉÈÊ]/g, 'E')
    .replace(/[ÍÌÎ]/g, 'I')
    .replace(/[ÓÒÔÕ]/g, 'O')
    .replace(/[ÚÙÛ]/g, 'U')
    .replace(/[Ç]/g, 'C');
}

function getPDFStreamLength(content: ContractContent, signedDateStr: string): number {
  // Approximate length of the stream content
  return 800 + 
    (content.schoolName?.length || 0) +
    (content.guardianName?.length || 0) +
    (content.studentName?.length || 0) +
    (content.courseName?.length || 0) +
    signedDateStr.length;
}
