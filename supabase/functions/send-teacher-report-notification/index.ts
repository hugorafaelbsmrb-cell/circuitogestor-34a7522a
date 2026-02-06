import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  reportId: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { reportId, status, rejectionReason } = await req.json() as RequestBody;

    if (!reportId || !status) {
      return new Response(
        JSON.stringify({ error: 'reportId and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-teacher-report-notification] Processing ${status} notification for report:`, reportId);

    // Check if automation is enabled
    const { data: automationSetting } = await supabase
      .from('automation_settings')
      .select('enabled, config')
      .eq('key', 'auto_teacher_report_notification')
      .single();

    if (!automationSetting?.enabled) {
      console.log('[send-teacher-report-notification] Automation is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'Automation is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = automationSetting.config as { template_approved?: string; template_rejected?: string };

    // Fetch report with teacher data
    const { data: report, error: reportError } = await supabase
      .from('student_reports')
      .select(`
        id,
        title,
        report_date,
        rejection_reason,
        student:students(name),
        teacher:teachers(id, name, phone)
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('[send-teacher-report-notification] Report not found:', reportError);
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teacher = report.teacher as { id: string; name: string; phone: string } | null;
    
    if (!teacher?.phone) {
      console.log('[send-teacher-report-notification] Teacher has no phone number');
      return new Response(
        JSON.stringify({ success: false, message: 'Teacher has no phone number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API configuration
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

    const getSettingValue = (key: string) => settings?.find(s => s.key === key)?.value || '';
    
    const wapiUrl = getSettingValue('W_API_URL') || 'https://api.w-api.app';
    const wapiToken = getSettingValue('W_API_TOKEN');
    const wapiInstanceId = getSettingValue('W_API_SESSION');

    if (!wapiToken || !wapiInstanceId) {
      console.error('[send-teacher-report-notification] W-API not configured');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    const phone = teacher.phone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

    // Get teacher first name
    const teacherFirstName = teacher.name?.split(' ')[0] || 'Professor';
    
    // Get student name
    const student = report.student as { name: string } | null;
    const studentName = student?.name || 'Aluno';

    // Format date
    const reportDate = report.report_date 
      ? new Date(report.report_date).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    // Select template based on status
    const templateKey = status === 'approved' ? 'template_approved' : 'template_rejected';
    const defaultApproved = 'Olá {nome}! 🎉\n\nSeu relatório de *{aluno}* foi *APROVADO* e já está disponível no portal dos pais.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\nObrigado pelo excelente trabalho!';
    const defaultRejected = 'Olá {nome}!\n\nSeu relatório de *{aluno}* precisa de *REVISÃO*.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\n⚠️ *Motivo:* {motivo}\n\nPor favor, faça os ajustes necessários e reenvie.';
    
    const template = config[templateKey] || (status === 'approved' ? defaultApproved : defaultRejected);

    // Replace template variables
    let message = template
      .replace(/{nome}/g, teacherFirstName)
      .replace(/{aluno}/g, studentName)
      .replace(/{data}/g, reportDate)
      .replace(/{titulo}/g, report.title || 'Relatório')
      .replace(/{motivo}/g, rejectionReason || report.rejection_reason || 'Não especificado')
      .replace(/\\n/g, '\n');

    console.log(`[send-teacher-report-notification] Sending ${status} notification to ${formattedPhone}`);

    // Save message to database
    const { data: messageRecord, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: formattedPhone,
        message,
        direction: 'outgoing',
        status: 'pending',
      })
      .select()
      .single();

    if (messageError) {
      console.error('[send-teacher-report-notification] Error saving message:', messageError);
    }

    // Send message via W-API
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
    console.log('[send-teacher-report-notification] W-API response:', sendResult);

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
      message_preview: `[${status === 'approved' ? 'APROVADO' : 'REJEITADO'}] Relatório - ${studentName}`,
      status: sendResponse.ok ? 'sent' : 'failed',
      automation_key: 'auto_teacher_report_notification',
      template_category: `report_${status}`,
    });

    if (!sendResponse.ok) {
      console.error('[send-teacher-report-notification] W-API error:', sendResult);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send message', details: sendResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sendResult?.id || sendResult?.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-teacher-report-notification] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
