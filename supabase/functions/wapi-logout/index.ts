import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default W-API URL (can be overridden by app_settings)
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

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

    console.log('=== W-API Logout ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO logout endpoints
    // Auth: Authorization: Bearer {{TOKEN}}
    const candidates: Array<{ method: 'DELETE' | 'POST'; url: string }> = [
      { method: 'DELETE', url: `${baseUrl}/v1/instance/logout?instanceId=${encoded}` },
      { method: 'POST', url: `${baseUrl}/v1/instance/logout?instanceId=${encoded}` },
      { method: 'DELETE', url: `${baseUrl}/instance/logout?instanceId=${encoded}` },
      { method: 'POST', url: `${baseUrl}/instance/logout?instanceId=${encoded}` },
    ];

    const attempts: Array<{ method: string; url: string; status: number | null; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      try {
        console.log(`Trying: ${c.method} ${c.url}`);
        
        const res = await fetch(c.url, {
          method: c.method,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        const responseText = await res.text();
        console.log(`Response ${res.status}: ${responseText.slice(0, 200)}`);
        
        attempts.push({ method: c.method, url: c.url, status: res.status, ok: res.ok });

        if (!res.ok) continue;

        let parsed: any = null;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = { raw: responseText };
        }

        return new Response(
          JSON.stringify({
            success: true,
            endpoint: c.url,
            data: parsed,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (e) {
        console.error(`Error with ${c.method} ${c.url}:`, e);
        attempts.push({
          method: c.method,
          url: c.url,
          status: null,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    console.error('All logout attempts failed:', attempts);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Não foi possível desconectar na W-API.',
        hint: 'Verifique se o endpoint de logout está disponível para sua instância.',
        attempts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in wapi-logout:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
