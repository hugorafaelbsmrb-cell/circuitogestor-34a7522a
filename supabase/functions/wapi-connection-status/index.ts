import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// W-API PRO uses api.wapi.com.br exclusively
const PRO_BASE_URL = 'https://api.wapi.com.br';

function parseConnection(data: any) {
  const stateRaw =
    data?.instance?.state ??
    data?.state ??
    data?.status ??
    data?.data?.state ??
    '';

  const state = String(stateRaw).toLowerCase();
  const connected =
    data?.connected === true ||
    state === 'open' ||
    state === 'connected' ||
    state === 'online' ||
    state === 'ready' ||
    state === 'true';

  const phone =
    data?.instance?.phone ??
    data?.phone ??
    data?.number ??
    data?.data?.phone ??
    null;

  return { connected, state: stateRaw ?? null, phone };
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
      .in('key', ['W_API_TOKEN', 'W_API_SESSION']);

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
    const encoded = encodeURIComponent(instanceId);

    console.log('=== W-API PRO Connection Status ===');
    console.log(`PRO Base URL: ${PRO_BASE_URL}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO endpoints for connection status
    // Using apikey header (not Bearer Authorization)
    const candidates: Array<{ url: string; method: 'GET' | 'POST' }> = [
      { url: `${PRO_BASE_URL}/connectionState?instanceId=${encoded}`, method: 'GET' },
      { url: `${PRO_BASE_URL}/instance/connectionState?instanceId=${encoded}`, method: 'GET' },
      { url: `${PRO_BASE_URL}/v1/instance/connectionState?instanceId=${encoded}`, method: 'GET' },
      { url: `${PRO_BASE_URL}/status?instanceId=${encoded}`, method: 'GET' },
      { url: `${PRO_BASE_URL}/v1/instance/qr-code?instanceId=${encoded}`, method: 'GET' },
    ];

    const attempts: Array<{ url: string; status: number | null; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      try {
        console.log(`Trying: ${c.method} ${c.url}`);
        
        const res = await fetch(c.url, {
          method: c.method,
          headers: {
            'apikey': apiKey,
            'Accept': 'application/json',
          },
        });

        const text = await res.text();
        console.log(`Response ${res.status}: ${text.slice(0, 200)}`);
        
        attempts.push({ url: c.url, status: res.status, ok: res.ok });

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }

        if (res.ok && parsed) {
          const conn = parseConnection(parsed);
          return new Response(
            JSON.stringify({
              success: true,
              ...conn,
              endpoint: c.url,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Even non-200 responses might contain status info
        if (parsed && !res.ok) {
          const conn = parseConnection(parsed);
          if (conn.state || typeof parsed.connected !== 'undefined') {
            return new Response(
              JSON.stringify({
                success: true,
                ...conn,
                endpoint: c.url,
                note: 'non-200 response parsed',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`Error with ${c.url}:`, errMsg);
        attempts.push({
          url: c.url,
          status: null,
          ok: false,
          error: errMsg,
        });
      }
    }

    console.error('W-API PRO status check failed', { attempts });
    return new Response(
      JSON.stringify({
        error: 'Não foi possível verificar o status na W-API PRO',
        attempts,
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
