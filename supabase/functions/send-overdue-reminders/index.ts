import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getTemplate(supabase: any, category: string): Promise<string | null> {
  const { data: templates } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'whatsapp_template_%');
  if (!templates) return null;
  for (const t of templates) {
    try {
      const parsed = JSON.parse(t.value);
      if (parsed.category === category && parsed.is_active !== false) {
        return parsed.message;
      }
    } catch {}
  }
  return null;
}

async function getSchoolName(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'system_name')
    .maybeSingle();
  return data?.value || 'Nossa Escola';
}

async function sendWhatsApp(
  config: Record<string, string>,
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const wapiUrl = config.W_API_URL.replace(/\/$/, '');
    const encodedInstanceId = encodeURIComponent(config.W_API_SESSION);
    const response = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    return response.ok;
  } catch (e) {
    console.error('WhatsApp send error', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const template = await getTemplate(supabase, 'payment_overdue');
    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template "payment_overdue" não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schoolName = await getSchoolName(supabase);

    // W-API config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);
    const config: Record<string, string> = {};
    settings?.forEach((s: any) => { if (s.value) config[s.key] = s.value; });
    if (!config.W_API_URL || !config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp (W-API) não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: payments } = await supabase
      .from('payments')
      .select(`id, guardian_id, value, due_date, bank_slip_url, invoice_url, description,
        guardian:guardians(id, name, phone)`)
      .or(`status.eq.OVERDUE,and(status.eq.PENDING,due_date.lt.${today})`);

    const overdue = (payments || []).filter((p: any) => p.guardian?.phone);
    console.log(`Found ${overdue.length} overdue payments to remind`);

    let sent = 0;
    let failed = 0;
    const DELAY_MS = 5000;

    for (let i = 0; i < overdue.length; i++) {
      const payment: any = overdue[i];
      const firstName = (payment.guardian.name || '').split(' ')[0];
      const message = template
        .replace(/{nome_responsavel}/g, firstName)
        .replace(/{valor}/g, `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`)
        .replace(/{vencimento}/g, new Date(payment.due_date + 'T00:00:00').toLocaleDateString('pt-BR'))
        .replace(/{link_boleto}/g, payment.bank_slip_url || payment.invoice_url || '')
        .replace(/{nome_escola}/g, schoolName);

      const ok = await sendWhatsApp(config, payment.guardian.phone, message);

      await supabase.from('message_logs').insert({
        guardian_id: payment.guardian.id,
        phone: payment.guardian.phone,
        template_category: 'payment_overdue',
        message_preview: message.substring(0, 100),
        automation_key: 'manual_payment_overdue_reminder',
        status: ok ? 'sent' : 'error',
        error_message: ok ? null : 'Falha no envio',
      });

      if (ok) sent++; else failed++;

      // 5-second interval between sends (skip after the last one)
      if (i < overdue.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: overdue.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-overdue-reminders error', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
