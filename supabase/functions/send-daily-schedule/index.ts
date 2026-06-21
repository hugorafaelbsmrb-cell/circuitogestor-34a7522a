import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CAMP_SLUG = 'colonia-2026';

interface ScheduleItem {
  day_label: string;
  time_label: string | null;
  title: string;
  description: string | null;
  sort_order: number;
}

interface Enrollment {
  guardian_name: string;
  guardian_phone: string;
  child_name: string;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const today = new Date();
    const todayBR = new Date(today.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayOfWeek = todayBR.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb

    // Só roda de segunda a sexta
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('Fim de semana — sem envio');
      return new Response(JSON.stringify({ skipped: true, reason: 'weekend' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca o camp
    const { data: camp } = await supabase
      .from('vacation_camps')
      .select('id, name, start_date, end_date, whatsapp_number')
      .eq('slug', CAMP_SLUG)
      .maybeSingle();

    if (!camp) {
      console.log('Camp não encontrado');
      return new Response(JSON.stringify({ error: 'Camp not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verifica se o evento está rolando
    const startDate = new Date(camp.start_date + 'T00:00:00-03:00');
    const endDate = new Date(camp.end_date + 'T23:59:59-03:00');
    if (todayBR < startDate || todayBR > endDate) {
      console.log('Fora do período da colônia');
      return new Response(JSON.stringify({ skipped: true, reason: 'out_of_range' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca a programação de hoje
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const todayName = dayNames[dayOfWeek];

    const { data: schedule } = await supabase
      .from('vacation_camp_schedule')
      .select('day_label, time_label, title, description, sort_order')
      .eq('camp_id', camp.id)
      .order('sort_order');

    if (!schedule || schedule.length === 0) {
      console.log('Nenhuma programação encontrada');
      return new Response(JSON.stringify({ error: 'No schedule' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const todaySchedule = schedule.find((s: ScheduleItem) => s.day_label.startsWith(todayName));
    if (!todaySchedule) {
      console.log(`Nenhuma atividade hoje (${todayName})`);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_activity_today' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Se for o dia do passeio (Sexta 10/07) e o envio for das 12h, pula
    // O passeio é de manhã (8h-11h30), não faz sentido mandar às 12h
    const currentHour = todayBR.getHours();
    const isPasseioDay = todaySchedule.day_label === 'Sexta-feira 10/07';
    if (isPasseioDay && currentHour >= 12) {
      console.log('Dia do passeio (manhã) — pulando envio das 12h');
      return new Response(JSON.stringify({ skipped: true, reason: 'morning_only_day_afternoon' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca inscritos confirmados
    const { data: enrollments } = await supabase
      .from('vacation_camp_enrollments')
      .select('guardian_name, guardian_phone, child_name')
      .eq('camp_id', camp.id)
      .eq('payment_status', 'confirmed');

    if (!enrollments || enrollments.length === 0) {
      console.log('Nenhum inscrito confirmado');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_enrollments' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca config W-API
    const { data: wapiSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    const wapiConfig: Record<string, string> = {};
    wapiSettings?.forEach((s: { key: string; value: string }) => {
      if (s.value) wapiConfig[s.key] = s.value;
    });

    if (!wapiConfig.W_API_TOKEN || !wapiConfig.W_API_SESSION) {
      console.log('W-API não configurada');
      return new Response(JSON.stringify({ error: 'W-API not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = (wapiConfig.W_API_URL || 'https://api.w-api.app').replace(/\/+$/, '');
    const instanceId = wapiConfig.W_API_SESSION;
    const apiToken = wapiConfig.W_API_TOKEN;

    // Constrói mensagem
    const emojiMap: Record<number, string> = {
      1: '⭐', 2: '🔬', 3: '🧪', 4: '⚽', 5: '🌳',
      6: '🥧', 7: '🎨', 8: '📄', 9: '🍿', 10: '🎊',
    };
    const dayEmoji = emojiMap[todaySchedule.sort_order] || '🎯';

    const message = [
      `☀️ *Bom dia, famílias da Colônia!*`,
      '',
      `${dayEmoji} *Programação de hoje — ${todaySchedule.day_label}*`,
      '',
      `⏰ *${todaySchedule.time_label || 'Horário normal'}*`,
      `🎯 *${todaySchedule.title}*`,
      '',
      todaySchedule.description ? `📋 ${todaySchedule.description}` : '',
      '',
      `🚀 Preparados para mais um dia incrível?`,
      `Qualquer dúvida, é só responder por aqui! 💚💛`,
    ].filter(Boolean).join('\n');

    // Envia para cada inscrito
    let sent = 0;
    let failed = 0;

    for (const enrollment of (enrollments as Enrollment[])) {
      try {
        const phone = enrollment.guardian_phone.replace(/\D/g, '');
        const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

        const wapiResponse = await fetch(
          `${baseUrl}/v1/message/send-text?instanceId=${encodeURIComponent(instanceId)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiToken}`,
            },
            body: JSON.stringify({
              phone: formattedPhone,
              message,
            }),
          }
        );

        const status = wapiResponse.ok ? 'sent' : 'failed';

        await supabase.from('whatsapp_messages').insert({
          phone: formattedPhone,
          message,
          direction: 'outgoing',
          status,
        });

        if (wapiResponse.ok) {
          sent++;
          console.log(`✅ Enviado para ${enrollment.guardian_name} (${formattedPhone})`);
        } else {
          failed++;
          console.log(`❌ Falha para ${enrollment.guardian_name}: ${await wapiResponse.text().then(t => t.slice(0, 200))}`);
        }
      } catch (err) {
        failed++;
        console.error(`Erro ao enviar para ${enrollment.guardian_name}:`, err);
      }
    }

    console.log(`Envio concluído: ${sent} sucesso, ${failed} falhas`);

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total: enrollments.length,
      day: todaySchedule.day_label,
      title: todaySchedule.title,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
