import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEND_DELAY_MS = 2500;

interface ScheduledMessage {
  id: string;
  message: string;
  recipient_ids: string[];
  scheduled_at: string;
  status: string;
  course_filter: string | null;
}

interface Guardian {
  id: string;
  name: string;
  phone: string;
}

interface Student {
  id: string;
  name: string;
  guardian_id: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  class_group_id: string;
  status: string;
}

interface ClassGroup {
  id: string;
  course_id: string;
}

interface Course {
  id: string;
  name: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFirstName = (fullName: string): string => {
  return fullName.trim().split(' ')[0] || fullName;
};

const getFirstAndLastName = (fullName: string): string => {
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get W-API configuration
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    const wapiToken = settingsMap.get('W_API_TOKEN');
    const wapiSession = settingsMap.get('W_API_SESSION');
    let wapiUrl = settingsMap.get('W_API_URL') || 'https://api.w-api.app';

    if (!wapiToken || !wapiSession) {
      console.log('W-API not configured, skipping scheduled messages');
      return new Response(
        JSON.stringify({ success: false, error: 'W-API not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure PRO URL
    if (wapiUrl.includes('api-')) {
      wapiUrl = 'https://api.w-api.app';
    }

    // Find pending scheduled messages that are due
    const now = new Date().toISOString();
    const { data: scheduledMessages, error: fetchError } = await supabase
      .from('scheduled_bulk_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError);
      throw fetchError;
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      console.log('No scheduled messages to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${scheduledMessages.length} scheduled messages to process`);

    // Fetch all guardians, students, enrollments, class_groups, and courses for personalization
    const [guardiansRes, studentsRes, enrollmentsRes, classGroupsRes, coursesRes] = await Promise.all([
      supabase.from('guardians').select('id, name, phone'),
      supabase.from('students').select('id, name, guardian_id'),
      supabase.from('enrollments').select('id, student_id, class_group_id, status').eq('status', 'active'),
      supabase.from('class_groups').select('id, course_id'),
      supabase.from('courses').select('id, name'),
    ]);

    const guardians: Guardian[] = guardiansRes.data || [];
    const students: Student[] = studentsRes.data || [];
    const enrollments: Enrollment[] = enrollmentsRes.data || [];
    const classGroups: ClassGroup[] = classGroupsRes.data || [];
    const courses: Course[] = coursesRes.data || [];

    // Create lookup maps
    const guardiansMap = new Map(guardians.map(g => [g.id, g]));
    const classGroupsMap = new Map(classGroups.map(cg => [cg.id, cg]));
    const coursesMap = new Map(courses.map(c => [c.id, c]));

    // Helper to get recipient data
    const getRecipientData = (guardianId: string) => {
      const guardian = guardiansMap.get(guardianId);
      if (!guardian) return null;

      const guardianStudents = students.filter(s => s.guardian_id === guardianId);
      const studentNames = guardianStudents.map(s => getFirstAndLastName(s.name));
      
      const courseIds = new Set<string>();
      guardianStudents.forEach(student => {
        const studentEnrollments = enrollments.filter(e => e.student_id === student.id);
        studentEnrollments.forEach(enrollment => {
          const classGroup = classGroupsMap.get(enrollment.class_group_id);
          if (classGroup) {
            courseIds.add(classGroup.course_id);
          }
        });
      });

      const courseNames = Array.from(courseIds)
        .map(id => coursesMap.get(id)?.name)
        .filter(Boolean) as string[];

      return {
        id: guardian.id,
        name: getFirstName(guardian.name),
        phone: guardian.phone,
        studentNames,
        courseNames,
      };
    };

    // Helper to personalize message
    const personalizeMessage = (
      message: string,
      recipient: { name: string; studentNames: string[]; courseNames: string[] }
    ) => {
      return message
        .replace(/{nome_responsavel}/g, recipient.name)
        .replace(/{nome}/g, recipient.name)
        .replace(/{nome_aluno}/g, recipient.studentNames[0] || '')
        .replace(/{nomes_alunos}/g, recipient.studentNames.join(', ') || '')
        .replace(/{curso}/g, recipient.courseNames[0] || '')
        .replace(/{cursos}/g, recipient.courseNames.join(', ') || '');
    };

    // Helper to format phone number
    const formatPhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('55')) return digits;
      return `55${digits}`;
    };

    let totalProcessed = 0;

    for (const scheduled of scheduledMessages as ScheduledMessage[]) {
      console.log(`Processing scheduled message ${scheduled.id}`);

      // Mark as processing
      await supabase
        .from('scheduled_bulk_messages')
        .update({ status: 'processing' })
        .eq('id', scheduled.id);

      let sentCount = 0;
      let errorCount = 0;

      for (const recipientId of scheduled.recipient_ids) {
        const recipient = getRecipientData(recipientId);
        if (!recipient) {
          console.log(`Recipient ${recipientId} not found, skipping`);
          errorCount++;
          continue;
        }

        const personalizedMessage = personalizeMessage(scheduled.message, recipient);
        const formattedPhone = formatPhone(recipient.phone);

        try {
          // Save message with pending status
          const { data: msgRecord } = await supabase
            .from('whatsapp_messages')
            .insert({
              phone: formattedPhone,
              message: personalizedMessage,
              direction: 'outgoing',
              status: 'pending',
              guardian_id: recipient.id,
            })
            .select('id')
            .single();

          // Send via W-API
          const sendResponse = await fetch(
            `${wapiUrl}/v1/messages/text?instanceId=${wapiSession}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': wapiToken,
              },
              body: JSON.stringify({
                phone: formattedPhone,
                message: personalizedMessage,
              }),
            }
          );

          const sendResult = await sendResponse.json();

          if (sendResponse.ok && sendResult.messageId) {
            // Update message status to sent
            if (msgRecord?.id) {
              await supabase
                .from('whatsapp_messages')
                .update({
                  status: 'sent',
                  wapi_message_id: sendResult.messageId,
                })
                .eq('id', msgRecord.id);
            }

            // Log success
            await supabase.from('message_logs').insert({
              phone: formattedPhone,
              guardian_id: recipient.id,
              template_category: 'scheduled_bulk',
              message_preview: personalizedMessage.substring(0, 100),
              automation_key: 'scheduled_bulk_messages',
              status: 'success',
            });

            sentCount++;
            console.log(`Message sent to ${formattedPhone}`);
          } else {
            // Update message status to failed
            if (msgRecord?.id) {
              await supabase
                .from('whatsapp_messages')
                .update({ status: 'failed' })
                .eq('id', msgRecord.id);
            }

            // Log error
            await supabase.from('message_logs').insert({
              phone: formattedPhone,
              guardian_id: recipient.id,
              template_category: 'scheduled_bulk',
              message_preview: personalizedMessage.substring(0, 100),
              automation_key: 'scheduled_bulk_messages',
              status: 'error',
              error_message: sendResult.error || 'Unknown error',
            });

            errorCount++;
            console.log(`Failed to send to ${formattedPhone}:`, sendResult);
          }
        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
          console.error(`Error sending to ${formattedPhone}:`, sendError);
          errorCount++;

          await supabase.from('message_logs').insert({
            phone: formattedPhone,
            guardian_id: recipient.id,
            template_category: 'scheduled_bulk',
            automation_key: 'scheduled_bulk_messages',
            status: 'error',
            error_message: errorMessage,
          });
        }

        // Rate limiting delay
        await sleep(SEND_DELAY_MS);
      }

      // Mark as completed
      await supabase
        .from('scheduled_bulk_messages')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          sent_count: sentCount,
          error_count: errorCount,
        })
        .eq('id', scheduled.id);

      console.log(`Completed scheduled message ${scheduled.id}: ${sentCount} sent, ${errorCount} errors`);
      totalProcessed++;
    }

    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing scheduled messages:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
