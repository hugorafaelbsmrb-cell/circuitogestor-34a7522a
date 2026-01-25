import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  contractId: string;
  pdfUrl?: string; // Optional: if provided, use this pre-generated PDF instead of generating one
  skipAutomationCheck?: boolean; // Optional: if true, skip automation setting check (for manual sends)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contractId, pdfUrl: preGeneratedPdfUrl, skipAutomationCheck } = await req.json() as RequestBody;

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if auto-notify is enabled (skip for manual sends)
    if (!skipAutomationCheck) {
      const { data: automationSetting } = await supabase
        .from('automation_settings')
        .select('enabled')
        .eq('key', 'auto_contract_signed_notify')
        .single();

      if (!automationSetting?.enabled) {
        console.log('Auto contract notification is disabled');
        return new Response(
          JSON.stringify({ success: false, message: 'Automation is disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Get W-API configuration
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION', 'whatsapp_template_contract_signed']);

    const getSettingValue = (key: string) => settings?.find(s => s.key === key)?.value || '';
    
    const wapiUrl = getSettingValue('W_API_URL') || 'https://api.w-api.app';
    const wapiToken = getSettingValue('W_API_TOKEN');
    const wapiInstanceId = getSettingValue('W_API_SESSION');
    const template = getSettingValue('whatsapp_template_contract_signed') || 
      'Olá {nome}! 🎉\n\nO contrato de matrícula de *{aluno}* no curso *{curso}* foi assinado com sucesso!\n\n✅ *Data da assinatura:* {data_assinatura}\n📄 *Hash de verificação:* {hash}\n\nO documento possui validade jurídica conforme MP 2.200-2/2001.\n\nAgradecemos pela confiança! 🙂';

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

    // Use pre-generated PDF URL if provided, otherwise try to find existing one in storage
    let pdfUrl = preGeneratedPdfUrl;
    
    if (!pdfUrl) {
      // Try to find existing PDF in storage
      const studentNameSafe = (contract.student?.name || 'contrato')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      
      // List files in contracts folder to find matching PDF
      const { data: files } = await supabase
        .storage
        .from('system-branding')
        .list('contratos', {
          search: `contrato_${studentNameSafe}`,
          sortBy: { column: 'created_at', order: 'desc' },
          limit: 1
        });

      if (files && files.length > 0) {
        const { data: urlData } = supabase
          .storage
          .from('system-branding')
          .getPublicUrl(`contratos/${files[0].name}`);
        pdfUrl = urlData?.publicUrl;
        console.log('Found existing PDF in storage:', pdfUrl);
      }
    }

    // Create safe filename
    const studentNameSafe = (contract.student?.name || 'contrato')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);

    // If no PDF available, send text message only
    if (!pdfUrl) {
      console.log('No PDF URL available, sending text message only');
      
      // Save message to database
      const { data: messageRecord, error: messageError } = await supabase
        .from('whatsapp_messages')
        .insert({
          phone: formattedPhone,
          message,
          direction: 'outgoing',
          guardian_id: contract.guardian_id,
          status: 'pending',
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error saving message:', messageError);
      }

      // Send text message via W-API
      const sendResponse = await fetch(
        `${wapiUrl}/v1/message/send-text?instanceId=${wapiInstanceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wapiToken}`,
          },
          body: JSON.stringify({
            phone: formattedPhone,
            message,
            isGroup: false,
          }),
        }
      );

      const sendResult = await sendResponse.json();
      console.log('W-API text response:', sendResult);

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
        message_preview: `Contrato assinado - ${contract.student?.name}`,
        status: sendResponse.ok ? 'sent' : 'failed',
        automation_key: 'auto_contract_signed_notify',
        template_category: 'contract_signed',
      });

      return new Response(
        JSON.stringify({ success: sendResponse.ok, messageId: sendResult?.id || sendResult?.messageId, note: 'Sent as text only (no PDF)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using PDF:', pdfUrl);

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

    // Send PDF document via W-API
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
          extension: 'pdf',
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
      message_preview: `[PDF] Contrato assinado - ${contract.student?.name}`,
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
