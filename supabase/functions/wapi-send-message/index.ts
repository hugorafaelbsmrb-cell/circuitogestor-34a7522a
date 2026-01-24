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
    wapiUrl = wapiUrl.replace(/\/api$/i, '');
    if (/\/\/(app\.)?wawp\.net\b/i.test(wapiUrl)) {
      wapiUrl = 'https://api.w-api.app';
    }

    const session = config.W_API_SESSION;
    const encoded = encodeURIComponent(session);

    // Endpoint candidates - ordered by what worked in production
    // The confirmed working endpoint is: /v1/message/send-text?instanceId=...
    const candidates: Array<{
      url: string;
      body: Record<string, unknown>;
      extraHeaders?: Record<string, string>;
    }> = [
      // ✅ CONFIRMED WORKING: /v1/message/send-text (singular) with query param
      {
        url: `${wapiUrl}/v1/message/send-text?instanceId=${encoded}`,
        body: { phone: formattedPhone, message, isGroup },
      },
      // Fallback: /v1/messages/send-text (plural) with query param
      {
        url: `${wapiUrl}/v1/messages/send-text?instanceId=${encoded}`,
        body: { phone: formattedPhone, message, isGroup },
      },
      // Fallback: with header instead of query param
      {
        url: `${wapiUrl}/v1/message/send-text`,
        body: { phone: formattedPhone, message, isGroup },
        extraHeaders: { instanceId: session },
      },
      // Legacy: /message/send-text (no /v1)
      {
        url: `${wapiUrl}/message/send-text?instanceId=${encoded}`,
        body: { session, phone: formattedPhone, message, isGroup },
      },
      // Some APIs use chatId format
      {
        url: `${wapiUrl}/v1/message/send-text?instanceId=${encoded}`,
        body: { chatId: `${formattedPhone}@c.us`, message, isGroup },
      },
    ];

    let lastError: string | null = null;
    let lastStatus: number | null = null;
    const attempts: Array<{ url: string; status: number | null; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      try {
        const res = await fetch(c.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.W_API_TOKEN}`,
            'Accept': 'application/json',
            ...(c.extraHeaders ?? {}),
          },
          body: JSON.stringify(c.body),
        });

        lastStatus = res.status;
        const text = await res.text();
        attempts.push({ url: c.url, status: res.status, ok: res.ok });

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Not JSON - skip this endpoint
          attempts[attempts.length - 1].error = 'Non-JSON response';
          continue;
        }

        // Success case
        if (res.ok) {
          console.log('Message sent successfully via:', c.url, { phone: formattedPhone });
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Mensagem enviada com sucesso',
              data: parsed,
              endpoint: c.url,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If we got a JSON error, store it for later
        lastError = parsed?.message || parsed?.error || JSON.stringify(parsed);
        attempts[attempts.length - 1].error = lastError || undefined;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        attempts.push({ url: c.url, status: null, ok: false, error: errMsg });
        lastError = errMsg;
      }
    }

    console.error('All W-API send endpoints failed:', { attempts, lastStatus, lastError });
    return new Response(
      JSON.stringify({
        error: 'Não foi possível enviar mensagem via W-API',
        lastStatus,
        details: lastError,
        attempts,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
