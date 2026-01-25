import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrollmentWelcomePayload {
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  studentName: string;
  courseName: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const payload: EnrollmentWelcomePayload = await req.json();
    const { guardianId, guardianName, guardianPhone, studentName, courseName } = payload;
    
    console.log('Processing enrollment welcome for:', { guardianName, studentName, courseName });
    
    // Check if automation is enabled
    const { data: automationSetting } = await supabase
      .from('automation_settings')
      .select('enabled')
      .eq('key', 'auto_enrollment_welcome')
      .single();
    
    if (!automationSetting?.enabled) {
      console.log('Enrollment welcome automation is disabled');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Automation disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the template
    const { data: templateData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'whatsapp_template_enrollment')
      .single();
    
    if (!templateData?.value) {
      console.log('No enrollment template found');
      return new Response(
        JSON.stringify({ success: false, error: 'Template not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let template: { message: string; is_active: boolean };
    try {
      template = JSON.parse(templateData.value);
    } catch {
      console.error('Failed to parse template');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid template format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!template.is_active) {
      console.log('Template is inactive');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Template inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get school name
    const { data: schoolConfig } = await supabase
      .from('contract_config')
      .select('school_name')
      .single();
    
    const schoolName = schoolConfig?.school_name || 'Nossa Escola';
    
    // Get W-API config
    const { data: wapiSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION', 'W_API_INSTANCE_ID']);
    
    const config: Record<string, string> = {};
    wapiSettings?.forEach((s: { key: string; value: string | null }) => {
      if (s.value) config[s.key] = s.value;
    });
    
    // Support both W_API_SESSION (legacy) and W_API_INSTANCE_ID (new)
    const instanceId = config.W_API_INSTANCE_ID || config.W_API_SESSION;
    
    if (!config.W_API_TOKEN || !instanceId) {
      console.log('W-API not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'W-API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Format the message with variables - extract first name only for guardian
    const firstName = guardianName.split(' ')[0];
    const message = template.message
      .replace(/{nome_responsavel}/g, firstName)
      .replace(/{nome_aluno}/g, studentName)
      .replace(/{nome_escola}/g, schoolName)
      .replace(/{curso}/g, courseName);
    
    // Format phone
    const cleanPhone = guardianPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    console.log('Sending welcome message to:', formattedPhone);
    
    // Send via W-API PRO
    const baseUrl = (config.W_API_URL || 'https://api.w-api.app').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/v1/message/send-text?instanceId=${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        isGroup: false,
      }),
    });
    
    const success = response.ok;
    const responseData = await response.json().catch(() => ({}));
    
    console.log('W-API response:', { success, status: response.status, data: responseData });
    
    // Log the message
    await supabase.from('message_logs').insert({
      guardian_id: guardianId,
      phone: guardianPhone,
      template_category: 'enrollment',
      message_preview: message.substring(0, 100),
      automation_key: 'auto_enrollment_welcome',
      status: success ? 'sent' : 'error',
      error_message: success ? null : `Status: ${response.status}`,
    });
    
    // Also save to whatsapp_messages for chat history
    if (success) {
      await supabase.from('whatsapp_messages').insert({
        guardian_id: guardianId,
        phone: formattedPhone,
        message: message,
        direction: 'outgoing',
        status: 'sent',
        wapi_message_id: responseData?.id || responseData?.messageId || null,
      });
    }
    
    return new Response(
      JSON.stringify({ success, sent: success }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in send-enrollment-welcome:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
