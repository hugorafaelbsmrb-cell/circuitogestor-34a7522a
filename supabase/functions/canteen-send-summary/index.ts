import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentSummary {
  student_id: string;
  student_name: string;
  items: {
    product_name: string;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
}

interface RequestBody {
  guardian_id: string;
  guardian_phone: string;
  guardian_name: string;
  week_start: string;
  week_end: string;
  students: StudentSummary[];
  total: number;
}

const DEFAULT_TEMPLATE = `🍽️ *CONSUMO SEMANAL - CANTINA*

Olá, {nome_responsavel}! Segue o resumo da semana {semana_inicio} a {semana_fim}:

{lista_consumos}

💰 *TOTAL: {total}*

Forma de pagamento: combinar com a cantina.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { guardian_id, guardian_phone, guardian_name, week_start, week_end, students, total } = body;

    // Get W-API settings and message template
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'canteen_message_template']);

    const wapiUrl = settings?.find(s => s.key === 'W_API_URL')?.value || 'https://api.w-api.app';
    const wapiToken = settings?.find(s => s.key === 'W_API_TOKEN')?.value;
    const messageTemplate = settings?.find(s => s.key === 'canteen_message_template')?.value || DEFAULT_TEMPLATE;

    if (!wapiToken) {
      return new Response(
        JSON.stringify({ error: 'W-API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format price helper
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(price);
    };

    // Build consumption list
    let listaConsumos = '';
    students.forEach(student => {
      listaConsumos += `👦 *${student.student_name}*\n`;
      student.items.forEach(item => {
        listaConsumos += `• ${item.quantity}x ${item.product_name} - ${formatPrice(item.total)}\n`;
      });
      listaConsumos += `Subtotal: ${formatPrice(student.subtotal)}\n\n`;
    });

    // Replace variables in template
    let message = messageTemplate
      .replace(/{nome_responsavel}/g, guardian_name.split(' ')[0])
      .replace(/{semana_inicio}/g, week_start)
      .replace(/{semana_fim}/g, week_end)
      .replace(/{lista_consumos}/g, listaConsumos.trim())
      .replace(/{total}/g, formatPrice(total));

    // Convert escaped newlines to real newlines
    message = message.replace(/\\n/g, '\n');

    // Format phone number
    let phone = guardian_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    // Send via W-API
    const wapiResponse = await fetch(`${wapiUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wapiToken}`
      },
      body: JSON.stringify({
        phone,
        message
      })
    });

    if (!wapiResponse.ok) {
      const errorText = await wapiResponse.text();
      console.error('W-API error:', errorText);
      throw new Error('Failed to send WhatsApp message');
    }

    // Log the message
    await supabase.from('message_logs').insert({
      phone: guardian_phone,
      guardian_id,
      template_category: 'cantina',
      automation_key: 'canteen_weekly_summary',
      message_preview: message.substring(0, 200),
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Summary sent successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
