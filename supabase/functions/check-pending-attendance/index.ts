import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbsentStudent {
  student_id: string;
  student_name: string;
  guardian_phone: string;
  guardian_name: string;
  course_name: string;
  expected_time: string;
  attendance_date: string;
  record_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get automation settings
    const { data: automationSetting } = await supabase
      .from('automation_settings')
      .select('enabled, config')
      .eq('key', 'auto_absence_notification')
      .single();

    if (!automationSetting?.enabled) {
      return new Response(
        JSON.stringify({ message: 'Absence notification automation is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = automationSetting.config as { tolerance_minutes: number; send_immediately: boolean };
    const toleranceMinutes = config.tolerance_minutes || 15;

    // Get current time and date
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    
    // Calculate the cutoff time (now - tolerance)
    const cutoffTime = new Date(now.getTime() - toleranceMinutes * 60 * 1000);
    const cutoffTimeStr = cutoffTime.toTimeString().split(' ')[0];

    // Find pending attendance records where:
    // - attendance_date is today
    // - status is 'pending'
    // - expected_time + tolerance has passed
    // - notification_sent_at is null
    const { data: pendingRecords, error: fetchError } = await supabase
      .from('attendance_records')
      .select(`
        id,
        student_id,
        expected_time,
        attendance_date,
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
      .eq('attendance_date', currentDate)
      .eq('status', 'pending')
      .is('notification_sent_at', null)
      .lt('expected_time', cutoffTimeStr);

    if (fetchError) {
      console.error('Error fetching pending records:', fetchError);
      throw fetchError;
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending absences to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingRecords.length} students past tolerance time`);

    // Mark records as absent
    const recordIds = pendingRecords.map(r => r.id);
    await supabase
      .from('attendance_records')
      .update({ status: 'absent' })
      .in('id', recordIds);

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
      console.log('W-API not configured, skipping notifications');
      return new Response(
        JSON.stringify({ 
          message: 'Students marked as absent but W-API not configured',
          absentCount: pendingRecords.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notifications
    let sentCount = 0;
    let errorCount = 0;

    for (const record of pendingRecords) {
      try {
        const student = record.student as any;
        const guardian = student?.guardian;
        const classGroup = record.class_group as any;
        const course = classGroup?.course;

        if (!guardian?.phone) {
          console.log(`No phone for student ${student?.name}`);
          continue;
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
        const response = await fetch(`${wapiUrl}/v1/message/send-text`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${wapiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId: wapiSession,
            phone: phone,
            message: message,
          }),
        });

        if (response.ok) {
          sentCount++;
          // Update notification_sent_at
          await supabase
            .from('attendance_records')
            .update({ notification_sent_at: new Date().toISOString() })
            .eq('id', record.id);

          // Log the message
          await supabase.from('message_logs').insert({
            phone: phone,
            guardian_id: guardian.id,
            template_category: 'absence_notification',
            message_preview: message.substring(0, 100),
            automation_key: 'auto_absence_notification',
            status: 'sent',
          });
        } else {
          errorCount++;
          const errorText = await response.text();
          console.error(`Failed to send to ${phone}:`, errorText);
        }

        // Delay between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        errorCount++;
        console.error('Error sending notification:', err);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Absence notifications processed',
        absentCount: pendingRecords.length,
        sentCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in check-pending-attendance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
