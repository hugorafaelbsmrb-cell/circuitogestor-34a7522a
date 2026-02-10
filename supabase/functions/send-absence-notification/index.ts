import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record_id } = await req.json();

    if (!record_id) {
      return new Response(
        JSON.stringify({ error: 'record_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the attendance record with student and guardian info
    const { data: record, error: fetchError } = await supabase
      .from('attendance_records')
      .select(`
        id,
        expected_time,
        attendance_date,
        status,
        student:students!inner(
          id,
          name,
          guardian:guardians!inner(
            id,
            name,
            phone
          )
        ),
        class_group:class_groups(
          id,
          name,
          course:courses(id, name)
        )
      `)
      .eq('id', record_id)
      .single();

    if (fetchError || !record) {
      return new Response(
        JSON.stringify({ error: 'Record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const student = record.student as any;
    const guardian = student?.guardian;
    const classGroup = record.class_group as any;
    const course = classGroup?.course;

    if (!guardian?.phone) {
      return new Response(
        JSON.stringify({ error: 'Guardian phone not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get message template
    const { data: templateSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'absence_notification_template')
      .single();

    const messageTemplate = templateSetting?.value || 
      'Olá, {nome_responsavel}! Notamos que {nome_aluno} não compareceu à aula de {curso} hoje ({data}) às {horario}.';

    // Get school name
    const { data: schoolNameSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'system_name')
      .single();

    const schoolName = schoolNameSetting?.value || 'Escola';

    // Get W-API settings
    const { data: wapiSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

    const wapiConfig = Object.fromEntries(
      (wapiSettings || []).map(s => [s.key, s.value])
    );

    const wapiUrl = wapiConfig.W_API_URL || 'https://api.w-api.app';
    const wapiToken = wapiConfig.W_API_TOKEN;
    const wapiSession = wapiConfig.W_API_SESSION;

    if (!wapiToken || !wapiSession) {
      return new Response(
        JSON.stringify({ error: 'W-API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone
    let phone = guardian.phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    // Format date
    const dateFormatted = new Date(record.attendance_date).toLocaleDateString('pt-BR');

    // Format time
    const timeFormatted = record.expected_time.substring(0, 5);

    // Replace variables in template
    const message = messageTemplate
      .replace(/{nome_responsavel}/g, guardian.name.split(' ')[0])
      .replace(/{nome_aluno}/g, student.name)
      .replace(/{curso}/g, course?.name || 'aula')
      .replace(/{horario}/g, timeFormatted)
      .replace(/{data}/g, dateFormatted)
      .replace(/{nome_escola}/g, schoolName)
      .replace(/\\n/g, '\n');

    // Send via W-API
    const encodedInstanceId = encodeURIComponent(wapiSession);
    const response = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('W-API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send message', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update notification_sent_at
    await supabase
      .from('attendance_records')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', record_id);

    // Log the message
    await supabase.from('message_logs').insert({
      phone: phone,
      guardian_id: guardian.id,
      template_category: 'absence_notification',
      message_preview: message.substring(0, 100),
      automation_key: 'manual_absence_notification',
      status: 'sent',
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        phone: phone,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-absence-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
