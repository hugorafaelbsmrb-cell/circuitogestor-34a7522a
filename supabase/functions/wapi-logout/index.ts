import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeBaseUrl(url?: string) {
  const raw = (url || '').trim();
  if (!raw) return 'https://api.w-api.app';

  let base = raw;
  base = base.replace(/^http:\/\//i, 'https://');
  base = base.replace(/\/+$/, '');
  base = base.replace(/\/api$/i, '');
  if (/\/\/(app\.)?wawp\.net\b/i.test(base)) {
    return 'https://api.w-api.app';
  }
  return base;
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

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

    const baseUrl = normalizeBaseUrl(config.W_API_URL);
    const session = config.W_API_SESSION;

    const encoded = encodeURIComponent(session);
    const candidates: Array<{ method: 'DELETE' | 'POST'; url: string }> = [
      // Alguns provedores aceitam instanceId apenas via header (sem path/query)
      { method: 'DELETE', url: `${baseUrl}/v1/instance/logout` },
      { method: 'POST', url: `${baseUrl}/v1/instance/logout` },
      { method: 'DELETE', url: `${baseUrl}/instance/logout` },
      { method: 'POST', url: `${baseUrl}/instance/logout` },

      // Sem /v1
      { method: 'DELETE', url: `${baseUrl}/instance/logout/${encoded}` },
      { method: 'DELETE', url: `${baseUrl}/instance/logout?instanceId=${encoded}` },
      { method: 'POST', url: `${baseUrl}/instance/logout/${encoded}` },
      { method: 'POST', url: `${baseUrl}/instance/logout?instanceId=${encoded}` },

      // Com /v1
      { method: 'DELETE', url: `${baseUrl}/v1/instance/logout/${encoded}` },
      { method: 'DELETE', url: `${baseUrl}/v1/instance/logout?instanceId=${encoded}` },
      { method: 'POST', url: `${baseUrl}/v1/instance/logout/${encoded}` },
      { method: 'POST', url: `${baseUrl}/v1/instance/logout?instanceId=${encoded}` },
    ];

    const attempts: Array<{ method: string; url: string; status: number | null; ok: boolean; error?: string }> = [];

    let lastBody: string | null = null;
    let lastStatus: number | null = null;

    for (const c of candidates) {
      try {
        const res = await fetch(c.url, {
          method: c.method,
          headers: {
            Authorization: `Bearer ${config.W_API_TOKEN}`,
            Accept: 'application/json',
            // Para endpoints que usam header em vez de path/query
            instanceId: session,
          },
        });

        lastStatus = res.status;
        lastBody = await res.text();
        attempts.push({ method: c.method, url: c.url, status: res.status, ok: res.ok });

        if (!res.ok) continue;

        let parsed: any = null;
        try {
          parsed = JSON.parse(lastBody);
        } catch {
          parsed = null;
        }

        return new Response(
          JSON.stringify({
            success: true,
            endpoint: c.url,
            data: parsed ?? { raw: lastBody },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (e) {
        attempts.push({
          method: c.method,
          url: c.url,
          status: null,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Não foi possível desconectar na W-API',
        lastStatus,
        lastBody: lastBody?.slice(0, 400) ?? null,
        attempts,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in wapi-logout:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
