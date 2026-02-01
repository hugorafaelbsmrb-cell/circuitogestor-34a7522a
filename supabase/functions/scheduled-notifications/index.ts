import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationSetting {
  key: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface Guardian {
  id: string;
  name: string;
  phone: string;
}

interface Payment {
  id: string;
  guardian_id: string;
  value: number;
  due_date: string;
  bank_slip_url: string | null;
  invoice_url: string | null;
  description: string;
  guardian: Guardian;
}

interface Student {
  id: string;
  name: string;
  birth_date: string;
  guardian_id: string;
  guardian: Guardian;
}

async function getTemplate(supabase: any, category: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .like('key', 'whatsapp_template_%')
    .single();
  
  if (!data) return null;
  
  // Fetch all templates and find by category
  const { data: templates } = await supabase
    .from('app_settings')
    .select('value')
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
    .single();
  
  return data?.value || 'Nossa Escola';
}

async function sendWhatsAppMessage(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  phone: string,
  message: string,
  guardianId: string | null,
  automationKey: string,
  templateCategory: string
): Promise<boolean> {
  try {
    // Get W-API config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);
    
    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      if (s.value) config[s.key] = s.value;
    });
    
    if (!config.W_API_URL || !config.W_API_TOKEN || !config.W_API_SESSION) {
      console.log('W-API not configured, skipping send');
      return false;
    }
    
    // Format phone
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Send via W-API - using Bearer token authentication
    const wapiUrl = config.W_API_URL.replace(/\/$/, '');
    const response = await fetch(`${wapiUrl}/message/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({
        session: config.W_API_SESSION,
        phone: formattedPhone,
        message: message,
        isGroup: false,
      }),
    });
    
    const success = response.ok;
    
    // Log the message
    const adminClient = createClient(supabaseUrl, supabaseKey);
    await adminClient.from('message_logs').insert({
      guardian_id: guardianId,
      phone: phone,
      template_category: templateCategory,
      message_preview: message.substring(0, 100),
      automation_key: automationKey,
      status: success ? 'sent' : 'error',
      error_message: success ? null : 'Falha no envio',
    });
    
    return success;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

async function processPaymentReminders48h(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing 48h payment reminders...');
  
  const template = await getTemplate(supabase, 'payment_due_48h');
  if (!template) {
    console.log('No template found for payment_due_48h');
    return;
  }
  
  // Get payments due in 2 days
  const today = new Date();
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const targetDate = twoDaysFromNow.toISOString().split('T')[0];
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, bank_slip_url, invoice_url, description,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .eq('due_date', targetDate);
  
  if (!payments || payments.length === 0) {
    console.log('No payments due in 48h');
    return;
  }
  
  console.log(`Found ${payments.length} payments due in 48h`);
  
  for (const payment of payments) {
    if (!payment.guardian) continue;
    
    const message = template
      .replace(/{nome_responsavel}/g, payment.guardian.name)
      .replace(/{valor}/g, `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`)
      .replace(/{valor_48h}/g, `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`)
      .replace(/{vencimento}/g, new Date(payment.due_date).toLocaleDateString('pt-BR'))
      .replace(/{vencimento_48h}/g, new Date(payment.due_date).toLocaleDateString('pt-BR'))
      .replace(/{link_boleto}/g, payment.bank_slip_url || payment.invoice_url || '')
      .replace(/{link_boleto_48h}/g, payment.bank_slip_url || payment.invoice_url || '')
      .replace(/{nome_escola}/g, schoolName);
    
    await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_reminder_48h', 'payment_due_48h'
    );
    
    // Small delay between sends
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function processOverduePayments(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing overdue payment notifications...');
  
  const template = await getTemplate(supabase, 'payment_overdue');
  if (!template) {
    console.log('No template found for payment_overdue');
    return;
  }
  
  // Get overdue payments
  const today = new Date().toISOString().split('T')[0];
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, bank_slip_url, invoice_url, description,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'OVERDUE')
    .lt('due_date', today);
  
  if (!payments || payments.length === 0) {
    console.log('No overdue payments');
    return;
  }
  
  console.log(`Found ${payments.length} overdue payments`);
  
  for (const payment of payments) {
    if (!payment.guardian) continue;
    
    const message = template
      .replace(/{nome_responsavel}/g, payment.guardian.name)
      .replace(/{valor}/g, `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`)
      .replace(/{vencimento}/g, new Date(payment.due_date).toLocaleDateString('pt-BR'))
      .replace(/{link_boleto}/g, payment.bank_slip_url || payment.invoice_url || '')
      .replace(/{nome_escola}/g, schoolName);
    
    await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_overdue', 'payment_overdue'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function processBirthdayGreetings(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing birthday greetings...');
  
  const template = await getTemplate(supabase, 'birthday');
  if (!template) {
    console.log('No template found for birthday');
    return;
  }
  
  // Get students with birthday today
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const { data: students } = await supabase
    .from('students')
    .select(`
      id, name, birth_date, guardian_id,
      guardian:guardians(id, name, phone)
    `)
    .eq('is_active', true)
    .like('birth_date', `%-${monthDay}`);
  
  if (!students || students.length === 0) {
    console.log('No birthdays today');
    return;
  }
  
  console.log(`Found ${students.length} birthdays today`);
  
  for (const student of students) {
    if (!student.guardian) continue;
    
    const message = template
      .replace(/{nome_responsavel}/g, student.guardian.name)
      .replace(/{nome_aluno}/g, student.name)
      .replace(/{nome_escola}/g, schoolName);
    
    await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      student.guardian.phone, message, student.guardian.id,
      'auto_birthday_greeting', 'birthday'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function getAsaasConfig(supabase: any): Promise<{ asaasApiKey: string | null; asaasApiUrl: string }> {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['ASAAS_API_KEY', 'ASAAS_API_URL']);
  
  const config: Record<string, string> = {};
  settings?.forEach((s: any) => {
    if (s.value) config[s.key] = s.value;
  });
  
  return {
    asaasApiKey: Deno.env.get('ASAAS_API_KEY') || config.ASAAS_API_KEY || null,
    asaasApiUrl: config.ASAAS_API_URL || 'https://api.asaas.com/v3',
  };
}

async function fetchPixCode(asaasApiUrl: string, asaasApiKey: string, paymentId: string): Promise<string | null> {
  try {
    const pixResponse = await fetch(`${asaasApiUrl}/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': asaasApiKey,
      },
    });
    
    if (!pixResponse.ok) return null;
    
    const pixData = await pixResponse.json();
    return pixData.payload || null;
  } catch (error) {
    console.error(`Error fetching PIX for payment ${paymentId}:`, error);
    return null;
  }
}

async function processPixReminder2Days(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing PIX reminders 2 days before due...');
  
  const template = await getTemplate(supabase, 'pix_reminder');
  
  // Get payments due in 2 days
  const today = new Date();
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const targetDate = twoDaysFromNow.toISOString().split('T')[0];
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .eq('due_date', targetDate)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No payments due in 2 days with Asaas ID');
    return;
  }
  
  console.log(`Found ${payments.length} payments due in 2 days`);
  
  const { asaasApiKey, asaasApiUrl } = await getAsaasConfig(supabase);
  
  if (!asaasApiKey) {
    console.log('Asaas API key not configured');
    return;
  }
  
  for (const payment of payments) {
    if (!payment.guardian || !payment.asaas_payment_id) continue;
    
    const pixCode = await fetchPixCode(asaasApiUrl, asaasApiKey, payment.asaas_payment_id);
    if (!pixCode) {
      console.log(`No PIX payload for payment ${payment.id}`);
      continue;
    }
    
    const valueFormatted = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
    const dueDateFormatted = new Date(payment.due_date).toLocaleDateString('pt-BR');
    
    let message = template || `💳 *Lembrete de Pagamento - PIX*

Olá, {nome_responsavel}!

Sua parcela vence em 2 dias:

📋 *Descrição:* {descricao}
💰 *Valor:* {valor}
📅 *Vencimento:* {vencimento}

📱 *Código PIX (copie e cole):*
\`\`\`
{codigo_pix}
\`\`\`

Att,
{nome_escola}`;
    
    message = message
      .replace(/{nome_responsavel}/g, payment.guardian.name.split(' ')[0])
      .replace(/{descricao}/g, payment.description)
      .replace(/{valor}/g, valueFormatted)
      .replace(/{vencimento}/g, dueDateFormatted)
      .replace(/{codigo_pix}/g, pixCode)
      .replace(/{nome_escola}/g, schoolName);
    
    await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_pix_reminder_2d', 'pix_reminder'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function processPixOverdue1Day(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing PIX reminders 1 day after due...');
  
  const template = await getTemplate(supabase, 'pix_overdue');
  
  // Get payments that were due yesterday and are still pending/overdue
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = yesterday.toISOString().split('T')[0];
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id,
      guardian:guardians(id, name, phone)
    `)
    .in('status', ['PENDING', 'OVERDUE'])
    .eq('due_date', targetDate)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No overdue payments from yesterday');
    return;
  }
  
  console.log(`Found ${payments.length} overdue payments from yesterday`);
  
  const { asaasApiKey, asaasApiUrl } = await getAsaasConfig(supabase);
  
  if (!asaasApiKey) {
    console.log('Asaas API key not configured');
    return;
  }
  
  for (const payment of payments) {
    if (!payment.guardian || !payment.asaas_payment_id) continue;
    
    const pixCode = await fetchPixCode(asaasApiUrl, asaasApiKey, payment.asaas_payment_id);
    if (!pixCode) {
      console.log(`No PIX payload for payment ${payment.id}`);
      continue;
    }
    
    const valueFormatted = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
    const dueDateFormatted = new Date(payment.due_date).toLocaleDateString('pt-BR');
    
    let message = template || `⚠️ *Parcela Vencida - Regularize Agora*

Olá, {nome_responsavel}!

Identificamos que sua parcela venceu ontem e ainda não foi paga:

📋 *Descrição:* {descricao}
💰 *Valor:* {valor}
📅 *Vencimento:* {vencimento}

Para evitar juros e multas, regularize agora via PIX:

📱 *Código PIX (copie e cole):*
\`\`\`
{codigo_pix}
\`\`\`

Att,
{nome_escola}`;
    
    message = message
      .replace(/{nome_responsavel}/g, payment.guardian.name.split(' ')[0])
      .replace(/{descricao}/g, payment.description)
      .replace(/{valor}/g, valueFormatted)
      .replace(/{vencimento}/g, dueDateFormatted)
      .replace(/{codigo_pix}/g, pixCode)
      .replace(/{nome_escola}/g, schoolName);
    
    await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_pix_overdue_1d', 'pix_overdue'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check which automations are enabled
    const { data: automations } = await supabase
      .from('automation_settings')
      .select('key, enabled, config')
      .eq('enabled', true);
    
    if (!automations || automations.length === 0) {
      console.log('No automations enabled');
      return new Response(
        JSON.stringify({ success: true, message: 'No automations enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const enabledKeys = automations.map(a => a.key);
    console.log('Enabled automations:', enabledKeys);
    
    const schoolName = await getSchoolName(supabase);
    
    // Process each enabled automation
    if (enabledKeys.includes('auto_payment_reminder_48h')) {
      await processPaymentReminders48h(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    if (enabledKeys.includes('auto_payment_overdue')) {
      await processOverduePayments(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    if (enabledKeys.includes('auto_birthday_greeting')) {
      await processBirthdayGreetings(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    if (enabledKeys.includes('auto_payment_pix_reminder_2d')) {
      await processPixReminder2Days(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    if (enabledKeys.includes('auto_payment_pix_overdue_1d')) {
      await processPixOverdue1Day(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    return new Response(
      JSON.stringify({ success: true, processed: enabledKeys }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in scheduled-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});