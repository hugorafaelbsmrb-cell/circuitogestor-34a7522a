import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  phone: string;
  message: string;
  isGroup?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config: Record<string, string> = {};
    settings?.forEach(s => {
      if (s.value) config[s.key] = s.value;
    });

    if (!config.W_API_URL || !config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ 
          error: 'Configurações W-API incompletas',
          missing: {
            url: !config.W_API_URL,
            token: !config.W_API_TOKEN,
            session: !config.W_API_SESSION,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { phone, message, isGroup = false }: SendMessageRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Telefone e mensagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits, ensure country code)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // Normalize base URL
    let wapiUrl = config.W_API_URL.replace(/\/$/, '');
    wapiUrl = wapiUrl.replace(/^http:\/\//i, 'https://');
    if (/\/\/(app\.)?wawp\.net\b/i.test(wapiUrl)) {
      wapiUrl = 'https://api.w-api.app';
    }

    // Build endpoint - W-API docs use /v1/messages/send-text with instanceId as query param
    const sendUrl = `${wapiUrl}/v1/messages/send-text?instanceId=${encodeURIComponent(config.W_API_SESSION)}`;

    // Send message via W-API
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
        'instanceId': config.W_API_SESSION,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        isGroup: isGroup,
      }),
    });

    const responseText = await response.text();
    let responseData: any = null;

    // Try to parse JSON, handle HTML error pages gracefully
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error('W-API returned non-JSON response:', responseText.substring(0, 500));
      return new Response(
        JSON.stringify({ 
          error: 'W-API retornou resposta inválida (não JSON)',
          status: response.status,
          hint: 'Verifique se a URL da API e as credenciais estão corretas.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error('W-API error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao enviar mensagem',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message sent successfully:', { phone: formattedPhone, response: responseData });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        data: responseData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-send-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
