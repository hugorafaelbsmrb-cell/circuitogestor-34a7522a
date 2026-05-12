import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'payment_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select(`id, value, payment_date, due_date, description,
        guardian:guardians(id, name, phone)`)
      .eq('id', payment_id)
      .maybeSingle();

    if (payErr || !payment || !payment.guardian) {
      return new Response(JSON.stringify({ error: 'Payment or guardian not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get template payment_confirmed
    const { data: templates } = await supabase
      .from('app_settings')
      .select('value')
      .like('key', 'whatsapp_template_%');

    let templateMessage: string | null = null;
    for (const t of templates || []) {
      try {
        const parsed = JSON.parse(t.value);
        if (parsed.category === 'payment_confirmed' && parsed.is_active !== false) {
          templateMessage = parsed.message;
          break;
        }
      } catch {}
    }

    if (!templateMessage) {
      return new Response(JSON.stringify({ error: 'Template payment_confirmed não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: schoolSetting } = await supabase
      .from('app_settings').select('value').eq('key', 'system_name').maybeSingle();
    const schoolName = schoolSetting?.value || 'Nossa Escola';

    const { data: wapiSettings } = await supabase
      .from('app_settings').select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);
    const wapi: Record<string, string> = {};
    wapiSettings?.forEach((s: any) => { if (s.value) wapi[s.key] = s.value; });
    if (!wapi.W_API_URL || !wapi.W_API_TOKEN || !wapi.W_API_SESSION) {
      return new Response(JSON.stringify({ error: 'WhatsApp não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const g: any = payment.guardian;
    const firstName = (g.name || '').split(' ')[0];
    const dateStr = payment.payment_date
      ? new Date(payment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    const message = templateMessage
      .replace(/{nome_responsavel}/g, firstName)
      .replace(/{valor}/g, `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`)
      .replace(/{vencimento}/g, payment.due_date ? new Date(payment.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '')
      .replace(/{data_pagamento}/g, dateStr)
      .replace(/{nome_escola}/g, schoolName);

    const cleanPhone = (g.phone || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const wapiUrl = wapi.W_API_URL.replace(/\/$/, '');
    const encodedInstanceId = encodeURIComponent(wapi.W_API_SESSION);

    const resp = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wapi.W_API_TOKEN}`,
      },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    const success = resp.ok;

    await supabase.from('message_logs').insert({
      guardian_id: g.id,
      phone: g.phone,
      template_category: 'payment_confirmed',
      message_preview: message.substring(0, 100),
      automation_key: 'manual_payment_confirmed',
      status: success ? 'sent' : 'error',
      error_message: success ? null : 'Falha no envio',
    });

    return new Response(JSON.stringify({ success }), {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-payment-confirmation error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
