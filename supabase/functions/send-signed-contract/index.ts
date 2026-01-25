import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  contractId: string;
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
        course:courses(name, duration, price)
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

    // Generate PDF content
    const pdfBytes = generateContractPDFBytes({
      schoolName: contractConfig?.school_name || 'Circuito Kids',
      schoolCnpj: contractConfig?.school_cnpj || '',
      schoolAddress: contractConfig?.school_address || '',
      guardianName: contract.guardian?.name || '',
      guardianCpf: contract.guardian?.cpf || '',
      studentName: contract.student?.name || '',
      courseName: contract.course?.name || '',
      totalValue: contract.total_value || 0,
      installments: contract.installment_count || 1,
      signedAt: contract.signed_at,
      signatureHash: contract.signature_hash,
    });

    // Upload PDF to Supabase Storage
    const studentNameSafe = (contract.student?.name || 'contrato').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const timestamp = Date.now();
    const fileName = `contratos/contrato_${studentNameSafe}_${timestamp}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('system-branding')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('system-branding')
      .getPublicUrl(fileName);

    const pdfUrl = urlData?.publicUrl;
    console.log('PDF uploaded to:', pdfUrl);

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
        media_url: pdfUrl,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
    }

    // Send PDF document via W-API using URL
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
          document: pdfUrl,
      filename: `Contrato_${studentNameSafe}.pdf`,
          caption: message,
      isGroup: false,
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
      JSON.stringify({ success: true, messageId: sendResult?.id || sendResult?.messageId, pdfUrl }),
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

interface ContractPDFContent {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  guardianName: string;
  guardianCpf: string;
  studentName: string;
  courseName: string;
  totalValue: number;
  installments: number;
  signedAt?: string | null;
  signatureHash?: string | null;
}

// Generate a valid PDF using raw PDF syntax
function generateContractPDFBytes(content: ContractPDFContent): Uint8Array {
  const signedDateStr = content.signedAt 
    ? new Date(content.signedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('pt-BR');

  const installmentValue = content.installments > 0 
    ? (content.totalValue / content.installments).toFixed(2).replace('.', ',')
    : '0,00';

  // Build content stream with proper text positioning
  const lines = [
    { text: 'CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS', x: 50, y: 750, size: 16, bold: true },
    { text: escapeText(content.schoolName), x: 50, y: 720, size: 12, bold: false },
    { text: `CNPJ: ${escapeText(content.schoolCnpj)}`, x: 50, y: 700, size: 10, bold: false },
    { text: escapeText(content.schoolAddress), x: 50, y: 680, size: 10, bold: false },
    { text: '', x: 50, y: 660, size: 10, bold: false },
    { text: 'DADOS DO CONTRATANTE', x: 50, y: 640, size: 12, bold: true },
    { text: `Responsavel: ${escapeText(content.guardianName)}`, x: 50, y: 620, size: 10, bold: false },
    { text: `CPF: ${escapeText(content.guardianCpf)}`, x: 50, y: 600, size: 10, bold: false },
    { text: '', x: 50, y: 580, size: 10, bold: false },
    { text: 'DADOS DO ALUNO E CURSO', x: 50, y: 560, size: 12, bold: true },
    { text: `Aluno(a): ${escapeText(content.studentName)}`, x: 50, y: 540, size: 10, bold: false },
    { text: `Curso: ${escapeText(content.courseName)}`, x: 50, y: 520, size: 10, bold: false },
    { text: `Valor Total: R$ ${content.totalValue.toFixed(2).replace('.', ',')}`, x: 50, y: 500, size: 10, bold: false },
    { text: `Parcelas: ${content.installments}x de R$ ${installmentValue}`, x: 50, y: 480, size: 10, bold: false },
    { text: '', x: 50, y: 460, size: 10, bold: false },
    { text: 'ASSINATURA DIGITAL', x: 50, y: 440, size: 12, bold: true },
    { text: `Data da Assinatura: ${signedDateStr}`, x: 50, y: 420, size: 10, bold: false },
    { text: `Hash de Verificacao: ${escapeText(content.signatureHash?.substring(0, 32) || 'N/A')}...`, x: 50, y: 400, size: 9, bold: false },
    { text: '', x: 50, y: 380, size: 10, bold: false },
    { text: 'Este documento foi assinado eletronicamente conforme', x: 50, y: 360, size: 8, bold: false },
    { text: 'MP 2.200-2/2001 e Lei 14.063/2020, possuindo validade juridica.', x: 50, y: 345, size: 8, bold: false },
  ];

  // Build content stream
  let contentStream = 'BT\n';
  for (const line of lines) {
    contentStream += `/F1 ${line.size} Tf\n`;
    contentStream += `${line.x} ${line.y} Td\n`;
    contentStream += `(${line.text}) Tj\n`;
    contentStream += `${-line.x} ${-line.y} Td\n`; // Reset position
  }
  contentStream += 'ET';

  const streamLength = contentStream.length;

  // Build PDF structure
  const pdf = `%PDF-1.4
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
<< /Length ${streamLength} >>
stream
${contentStream}
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(300 + streamLength).toString().padStart(3, '0')} 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  return new TextEncoder().encode(pdf);
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
    .replace(/[Ç]/g, 'C')
    .replace(/[ñ]/g, 'n')
    .replace(/[Ñ]/g, 'N');
}
