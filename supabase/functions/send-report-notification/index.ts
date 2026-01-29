import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  reportId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { reportId }: RequestBody = await req.json();

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'reportId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get report with student and guardian info
    const { data: report, error: reportError } = await supabase
      .from('student_reports')
      .select(`
        id,
        title,
        report_date,
        student:students(
          id,
          name,
          guardian:guardians(id, name, phone)
        )
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('Report not found:', reportError);
      return new Response(
        JSON.stringify({ error: 'Relatório não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const student = report.student as any;
    const guardian = student?.guardian as any;

    if (!guardian?.phone) {
      return new Response(
        JSON.stringify({ error: 'Responsável sem telefone cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION', 'system_name']);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      if (s.value) config[s.key] = s.value;
    });

    if (!config.W_API_URL || !config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ error: 'W-API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schoolName = config.system_name || 'Nossa Escola';
    const guardianFirstName = guardian.name.split(' ')[0];
    const studentName = student.name;

    // Format report date
    const reportDate = new Date(report.report_date);
    const formattedDate = reportDate.toLocaleDateString('pt-BR');

    // Build message
    const message = `Olá, ${guardianFirstName}! 👋

O relatório pedagógico de *${studentName}* já está disponível! 📚

📅 Data: ${formattedDate}
📝 ${report.title}

Acesse o portal dos pais para visualizar o relatório completo e acompanhar o desenvolvimento do seu filho(a).

Atenciosamente,
*${schoolName}*`;

    // Format phone
    const cleanPhone = guardian.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // Send via W-API
    const wapiUrl = config.W_API_URL.replace(/\/$/, '');
    const response = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${config.W_API_SESSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

    const wapiResult = await response.json();
    const success = response.ok;

    if (success) {
      // Update report with notification sent timestamp
      await supabase
        .from('student_reports')
        .update({ notification_sent_at: new Date().toISOString() })
        .eq('id', reportId);

      // Log the message
      await supabase.from('message_logs').insert({
        guardian_id: guardian.id,
        phone: guardian.phone,
        template_category: 'report_available',
        message_preview: message.substring(0, 100),
        automation_key: 'report_notification',
        status: 'sent',
      });
    }

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Notificação enviada' : 'Falha no envio',
        wapiResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-report-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
