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
    
    // Send via W-API - using correct v1 endpoint format
    const wapiUrl = config.W_API_URL.replace(/\/$/, '');
    const encodedInstanceId = encodeURIComponent(config.W_API_SESSION);
    const response = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`, {
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

// Check if today is a weekend (Saturday = 6, Sunday = 0)
function isWeekend(): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Check if today is Monday
function isMonday(): boolean {
  return new Date().getDay() === 1;
}

// Adjust target date to avoid weekends - if target falls on weekend, adjust accordingly
// For reminders (future dates): move to Friday before
// For overdue (past dates): process on Monday
function adjustDateForWeekends(targetDate: Date, isFutureDate: boolean): Date {
  const dayOfWeek = targetDate.getDay();
  
  if (isFutureDate) {
    // For future reminders, if the target is weekend, we need to send earlier
    // But the real issue is: if TODAY is weekend, don't send. Let Monday handle it.
    return targetDate;
  } else {
    // For overdue checks, include weekend dates on Monday
    return targetDate;
  }
}

// Get dates to check for 48h reminders (accounts for weekends)
function get48hReminderDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  // Always check payments due in 2 days
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(today.getDate() + 2);
  dates.push(twoDaysFromNow.toISOString().split('T')[0]);
  
  // If today is Monday, also check payments due on Sunday and Saturday (which would have been reminded on Sat/Sun)
  if (isMonday()) {
    // Payments due Wednesday (would have been reminded Sunday)
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    dates.push(threeDaysFromNow.toISOString().split('T')[0]);
    
    // Payments due Tuesday (would have been reminded Saturday)
    // But Saturday's reminder already counts 2 days ahead, so that's Monday = today
    // We need to check if there are payments for today that weren't reminded
  }
  
  return dates;
}

// Get dates to check for PIX 2-day reminders (accounts for weekends)  
function getPixReminder2DaysDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  // Always check payments due in 2 days
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(today.getDate() + 2);
  dates.push(twoDaysFromNow.toISOString().split('T')[0]);
  
  // If Monday, also include weekend-skipped dates
  if (isMonday()) {
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    dates.push(threeDaysFromNow.toISOString().split('T')[0]);
  }
  
  return dates;
}

// Get dates for overdue checks (accounts for weekends)
function getOverdueDates(): { checkDate: string; includeWeekend: boolean } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // If Monday, we need to include Saturday and Sunday overdue payments
  return {
    checkDate: todayStr,
    includeWeekend: isMonday()
  };
}

// Get dates for PIX 1-day overdue (accounts for weekends)
function getPixOverdue1DayDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  // Yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  dates.push(yesterday.toISOString().split('T')[0]);
  
  // If Monday, include Saturday, Friday and Thursday (payments that became overdue over weekend)
  if (isMonday()) {
    for (let i = 2; i <= 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  
  // If Tuesday, also check Friday in case Monday's run missed it
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 2) { // Tuesday
    for (let i = 2; i <= 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    }
  }
  
  return dates;
}

async function processPaymentReminders48h(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  // Skip on weekends - will process on Monday
  if (isWeekend()) {
    console.log('Skipping 48h payment reminders on weekend');
    return;
  }
  
  console.log('Processing 48h payment reminders...');
  
  const template = await getTemplate(supabase, 'payment_due_48h');
  if (!template) {
    console.log('No template found for payment_due_48h');
    return;
  }
  
  // Get target dates (includes weekend catch-up on Monday)
  const targetDates = get48hReminderDates();
  console.log('Checking payment dates:', targetDates);
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, bank_slip_url, invoice_url, description,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .in('due_date', targetDates);
  
  if (!payments || payments.length === 0) {
    console.log('No payments due for reminder dates');
    return;
  }
  
  console.log(`Found ${payments.length} payments for reminder`);
  
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
  // Skip on weekends - will process on Monday
  if (isWeekend()) {
    console.log('Skipping overdue payment notifications on weekend');
    return;
  }
  
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
    .in('key', ['ASAAS_API_KEY', 'ASAAS_API_URL', 'ASAAS_ENVIRONMENT']);
  
  const config: Record<string, string> = {};
  settings?.forEach((s: any) => {
    if (s.value) config[s.key] = s.value;
  });
  
  const apiKey = config.ASAAS_API_KEY || Deno.env.get('ASAAS_API_KEY') || null;
  const environment = config.ASAAS_ENVIRONMENT || 'sandbox';
  const isProduction = environment === 'production';
  const defaultUrl = isProduction 
    ? 'https://www.asaas.com/api/v3' 
    : 'https://sandbox.asaas.com/api/v3';
  
  return {
    asaasApiKey: apiKey,
    asaasApiUrl: config.ASAAS_API_URL || defaultUrl,
  };
}

async function fetchPixCode(asaasApiUrl: string, asaasApiKey: string, paymentId: string): Promise<string | null> {
  try {
    const url = `${asaasApiUrl}/payments/${paymentId}/pixQrCode`;
    console.log(`Fetching PIX from: ${url}`);
    const pixResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': asaasApiKey,
      },
    });
    
    if (!pixResponse.ok) {
      const errorText = await pixResponse.text();
      console.error(`PIX fetch failed for ${paymentId}: ${pixResponse.status} - ${errorText}`);
      return null;
    }
    
    const pixData = await pixResponse.json();
    return pixData.payload || null;
  } catch (error) {
    console.error(`Error fetching PIX for payment ${paymentId}:`, error);
    return null;
  }
}

async function processPixReminder2Days(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  // Skip on weekends - will process on Monday
  if (isWeekend()) {
    console.log('Skipping PIX 2-day reminders on weekend');
    return;
  }
  
  console.log('Processing PIX reminders 2 days before due...');
  
  const template = await getTemplate(supabase, 'pix_reminder');
  
  // Get target dates (includes weekend catch-up on Monday)
  const targetDates = getPixReminder2DaysDates();
  console.log('Checking PIX reminder dates:', targetDates);
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .in('due_date', targetDates)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No payments due for PIX reminder dates');
    return;
  }
  
  console.log(`Found ${payments.length} payments for PIX reminder`);
  
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

Sua parcela vence em breve:

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

async function processPixCreated(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  console.log('Processing PIX created notifications...');
  
  const template = await getTemplate(supabase, 'pix_created');
  
  // Get payments created in the last 24 hours that haven't had PIX sent
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString();
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id, created_at,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .gte('created_at', yesterdayStr)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No new payments for PIX notification');
    return;
  }
  
  // Filter out payments that already had PIX sent
  const paymentIds = payments.map((p: any) => p.guardian_id);
  const { data: sentLogs } = await supabase
    .from('message_logs')
    .select('guardian_id, phone')
    .eq('automation_key', 'auto_payment_pix_created')
    .eq('status', 'sent')
    .gte('sent_at', yesterdayStr);
  
  const sentGuardianPhones = new Set(
    (sentLogs || []).map((l: any) => l.phone)
  );
  
  console.log(`Found ${payments.length} new payments, ${sentGuardianPhones.size} already notified`);
  
  const { asaasApiKey, asaasApiUrl } = await getAsaasConfig(supabase);
  
  if (!asaasApiKey) {
    console.log('Asaas API key not configured');
    return;
  }
  
  for (const payment of payments) {
    if (!payment.guardian || !payment.asaas_payment_id) continue;
    if (sentGuardianPhones.has(payment.guardian.phone)) continue;
    
    const pixCode = await fetchPixCode(asaasApiUrl, asaasApiKey, payment.asaas_payment_id);
    if (!pixCode) {
      console.log(`No PIX payload for payment ${payment.id}`);
      continue;
    }
    
    const valueFormatted = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
    const dueDateFormatted = new Date(payment.due_date).toLocaleDateString('pt-BR');
    
    let message = template || `💳 *Código PIX para Pagamento*

Olá, {nome_responsavel}!

Segue o código PIX para pagamento:

📋 *Descrição:* {descricao}
💰 *Valor:* {valor}
📅 *Vencimento:* {vencimento}

📱 *Código PIX (copie e cole):*
\`\`\`
{codigo_pix}
\`\`\`

✅ Basta copiar o código acima e colar no seu aplicativo bancário!

Att,
{nome_escola}`;
    
    message = message
      .replace(/{nome_responsavel}/g, payment.guardian.name.split(' ')[0])
      .replace(/{descricao}/g, payment.description)
      .replace(/{valor}/g, valueFormatted)
      .replace(/{vencimento}/g, dueDateFormatted)
      .replace(/{codigo_pix}/g, pixCode)
      .replace(/{nome_escola}/g, schoolName);
    
    const sent = await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_pix_created', 'pix_created'
    );
    
    // Only mark as sent if actually successful, so retries work
    if (sent) {
      sentGuardianPhones.add(payment.guardian.phone);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function processPixDueToday(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  // Skip on weekends - will process on Monday
  if (isWeekend()) {
    console.log('Skipping PIX due-today reminders on weekend');
    return;
  }
  
  console.log('Processing PIX due-today reminders...');
  
  const template = await getTemplate(supabase, 'pix_due_today');
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const dates = [today];
  
  // If Monday, also include Saturday and Sunday
  if (isMonday()) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dates.push(yesterday.toISOString().split('T')[0]); // Sunday
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    dates.push(twoDaysAgo.toISOString().split('T')[0]); // Saturday
  }
  
  console.log('Checking PIX due-today dates:', dates);
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id,
      guardian:guardians(id, name, phone)
    `)
    .eq('status', 'PENDING')
    .in('due_date', dates)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No payments due today for PIX reminder');
    return;
  }
  
  // Filter out already notified today
  const { data: sentLogs } = await supabase
    .from('message_logs')
    .select('phone')
    .eq('automation_key', 'auto_payment_pix_due_today')
    .eq('status', 'sent')
    .gte('sent_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z');
  
  const sentPhones = new Set((sentLogs || []).map((l: any) => l.phone));
  
  console.log(`Found ${payments.length} payments due today, ${sentPhones.size} already notified`);
  
  const { asaasApiKey, asaasApiUrl } = await getAsaasConfig(supabase);
  
  if (!asaasApiKey) {
    console.log('Asaas API key not configured');
    return;
  }
  
  for (const payment of payments) {
    if (!payment.guardian || !payment.asaas_payment_id) continue;
    if (sentPhones.has(payment.guardian.phone)) continue;
    
    const pixCode = await fetchPixCode(asaasApiUrl, asaasApiKey, payment.asaas_payment_id);
    if (!pixCode) {
      console.log(`No PIX payload for payment ${payment.id}`);
      continue;
    }
    
    const valueFormatted = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
    const dueDateFormatted = new Date(payment.due_date).toLocaleDateString('pt-BR');
    
    let message = template || `⏰ *Lembrete - Parcela Vence Hoje!*

Olá, {nome_responsavel}!

Sua parcela vence *hoje*:

📋 *Descrição:* {descricao}
💰 *Valor:* {valor}
📅 *Vencimento:* {vencimento}

📱 *Código PIX (copie e cole):*
\`\`\`
{codigo_pix}
\`\`\`

✅ Pague agora e evite juros!

Att,
{nome_escola}`;
    
    message = message
      .replace(/{nome_responsavel}/g, payment.guardian.name.split(' ')[0])
      .replace(/{descricao}/g, payment.description)
      .replace(/{valor}/g, valueFormatted)
      .replace(/{vencimento}/g, dueDateFormatted)
      .replace(/{codigo_pix}/g, pixCode)
      .replace(/{nome_escola}/g, schoolName);
    
    const sent = await sendWhatsAppMessage(
      supabase, supabaseUrl, supabaseKey,
      payment.guardian.phone, message, payment.guardian.id,
      'auto_payment_pix_due_today', 'pix_due_today'
    );
    
    if (sent) {
      sentPhones.add(payment.guardian.phone);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function processPixOverdue1Day(supabase: any, supabaseUrl: string, supabaseKey: string, schoolName: string) {
  // Skip on weekends - will process on Monday
  if (isWeekend()) {
    console.log('Skipping PIX 1-day overdue notifications on weekend');
    return;
  }
  
  console.log('Processing PIX reminders 1 day after due...');
  
  const template = await getTemplate(supabase, 'pix_overdue');
  
  // Get target dates (includes weekend catch-up on Monday)
  const targetDates = getPixOverdue1DayDates();
  console.log('Checking PIX overdue dates:', targetDates);
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, guardian_id, value, due_date, description, asaas_payment_id,
      guardian:guardians(id, name, phone)
    `)
    .in('status', ['PENDING', 'OVERDUE'])
    .in('due_date', targetDates)
    .not('asaas_payment_id', 'is', null);
  
  if (!payments || payments.length === 0) {
    console.log('No overdue payments for target dates');
    return;
  }
  
  console.log(`Found ${payments.length} overdue payments`);
  
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

Identificamos que sua parcela está vencida:

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
    
    if (enabledKeys.includes('auto_payment_pix_created')) {
      await processPixCreated(supabase, supabaseUrl, supabaseKey, schoolName);
    }
    
    if (enabledKeys.includes('auto_payment_pix_due_today')) {
      await processPixDueToday(supabase, supabaseUrl, supabaseKey, schoolName);
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