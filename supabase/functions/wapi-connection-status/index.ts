import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Service key available:', !!supabaseServiceKey);

    // Use service role to verify user token
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user using getUser with service role
    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);
    
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    console.log('getUser result:', { hasUser: !!userData?.user, error: userError?.message });
    
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('User authenticated:', userData.user.email);

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
