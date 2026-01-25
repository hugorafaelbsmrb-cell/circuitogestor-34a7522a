import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface TypingRequest {
  phone: string;
  duration?: number; // Duration in milliseconds (default 2500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    const config: Record<string, string> = {};
    settings?.forEach(s => {
      if (s.value) config[s.key] = s.value;
    });

    if (!config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ error: 'W-API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, duration = 2500 }: TypingRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const chatId = `${formattedPhone}@c.us`;

    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const instanceId = encodeURIComponent(config.W_API_SESSION);

    console.log(`=== W-API Typing Indicator ===`);
    console.log(`Chat ID: ${chatId}`);

    // Tenta múltiplos endpoints possíveis para compatibilidade
    const endpoints = [
      { url: `${baseUrl}/v1/chat/presence?instanceId=${instanceId}`, body: { chatId, presence: 'composing' } },
      { url: `${baseUrl}/v1/chat/start-typing?instanceId=${instanceId}`, body: { chatId } },
      { url: `${baseUrl}/chat/presence/${instanceId}`, body: { chatId, presence: 'composing' } },
    ];

    let success = false;
    for (const { url, body } of endpoints) {
      console.log(`Trying: ${url}`);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.W_API_TOKEN}`,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          console.log(`Success with endpoint: ${url}`);
          success = true;
          break;
        }
        
        const status = response.status;
        console.log(`Endpoint returned ${status}`);
        
        // Se não for 404, pode ser outro erro - não tentar mais
        if (status !== 404) break;
      } catch (err) {
        console.log(`Endpoint error: ${err}`);
      }
    }

    // Se nenhum endpoint funcionou, ainda consideramos sucesso
    // pois typing indicator é uma feature opcional e não deve bloquear o fluxo
    if (!success) {
      console.log('No typing endpoint available - feature not supported by this W-API instance');
    }

    // Wait for the specified duration to simulate typing
    if (duration > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(duration, 5000)));
    }

    // Sempre retorna sucesso para não bloquear o fluxo do usuário
    return new Response(
      JSON.stringify({ success: true, duration, actualApiSuccess: success }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-typing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
