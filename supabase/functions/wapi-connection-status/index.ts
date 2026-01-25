import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default W-API URL (can be overridden by app_settings)
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

function parseConnection(data: any) {
  // W-API PRO status-instance response format
  const status = data?.status || data?.state || data?.instance?.state || '';
  const statusLower = String(status).toLowerCase();
  
  const connected =
    data?.connected === true ||
    statusLower === 'connected' ||
    statusLower === 'open' ||
    statusLower === 'online' ||
    statusLower === 'ready';

  const phone =
    data?.phone ??
    data?.number ??
    data?.instance?.phone ??
    data?.data?.phone ??
    null;

  return { connected, state: status || null, phone };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar configurações' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config: Record<string, string> = {};
    settings?.forEach((s) => {
      if (s.value) config[s.key] = s.value;
    });

    if (!config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({
          error: 'Configurações W-API incompletas',
          missing: { token: !config.W_API_TOKEN, session: !config.W_API_SESSION },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    // Use W_API_URL from database or default to api.w-api.app
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const encoded = encodeURIComponent(instanceId);

    console.log('=== W-API Connection Status ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO endpoint for connection status (from official documentation)
    // Endpoint: GET /v1/instance/status-instance?instanceId={{INSTANCE_ID}}
    // Auth: Authorization: Bearer {{TOKEN}}
    const endpoint = `${baseUrl}/v1/instance/status-instance?instanceId=${encoded}`;

    console.log(`Calling: GET ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const text = await response.text();
    console.log(`Response ${response.status}: ${text.slice(0, 500)}`);

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Failed to parse response as JSON');
    }

    if (response.ok && parsed) {
      const conn = parseConnection(parsed);
      return new Response(
        JSON.stringify({
          success: true,
          ...conn,
          endpoint,
          raw: parsed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Handle error responses
    console.error('W-API status check failed', { status: response.status, body: text });
    return new Response(
      JSON.stringify({
        error: 'Não foi possível verificar o status na W-API',
        status: response.status,
        message: parsed?.message || parsed?.error || text.slice(0, 200),
        endpoint,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in wapi-connection-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
