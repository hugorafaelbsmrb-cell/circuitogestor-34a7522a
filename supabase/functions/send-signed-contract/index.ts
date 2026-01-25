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
        student:students(name),
        guardian:guardians(name, phone),
        course:courses(name)
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

    // Get W-API configuration (keys are uppercase in database)
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
      .replace('{nome}', guardianFirstName)
      .replace('{aluno}', contract.student?.name || 'Aluno')
      .replace('{curso}', contract.course?.name || 'Curso')
      .replace('{data_assinatura}', formattedDate)
      .replace('{hash}', contract.signature_hash?.substring(0, 16) + '...' || 'N/A')
      .replace(/\\n/g, '\n');

    // Save message to database first
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

    // Send via W-API
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
        }),
      }
    );

    const sendResult = await sendResponse.json();
    console.log('W-API response:', sendResult);

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
      message_preview: message.substring(0, 100),
      status: sendResponse.ok ? 'sent' : 'failed',
      automation_key: 'auto_contract_signed_notify',
      template_category: 'contract_signed',
    });

    if (!sendResponse.ok) {
      console.error('W-API error:', sendResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send message', details: sendResult }),
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
