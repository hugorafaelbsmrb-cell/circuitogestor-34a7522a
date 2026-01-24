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

    // Importante: existem variações de endpoint entre planos/coleções.
    // Tentamos em ordem até achar um que responda.
    const candidates = [
      `${baseUrl}/v1/instance/connectionState/${encodeURIComponent(session)}`,
      `${baseUrl}/v1/instance/connectionState?instanceId=${encodeURIComponent(session)}`,
      `${baseUrl}/v1/instance/status?instanceId=${encodeURIComponent(session)}`,
    ];

    let lastErr: unknown = null;
    let lastStatus: number | null = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.W_API_TOKEN}`,
            Accept: 'application/json',
          },
        });

        lastStatus = res.status;
        const text = await res.text();
        const contentType = res.headers.get('content-type') || '';

        let parsed: any = null;
        if (contentType.includes('application/json')) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = null;
          }
        } else {
          // Alguns endpoints retornam texto/HTML no erro
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = null;
          }
        }

        if (res.ok && (parsed || text)) {
          const payload = parsed ?? { raw: text };
          const conn = parseConnection(payload);
          return new Response(
            JSON.stringify({
              success: true,
              ...conn,
              endpoint: url,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Se não for OK, mas o endpoint existe e devolveu JSON de status, ainda tentamos extrair.
        if (parsed && !res.ok) {
          const conn = parseConnection(parsed);
          // Se a API devolve 4xx com payload indicando estado, usamos isso.
          if (conn.state || typeof parsed.connected !== 'undefined') {
            return new Response(
              JSON.stringify({
                success: true,
                ...conn,
                endpoint: url,
                note: 'non-200 response parsed',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }
      } catch (e) {
        lastErr = e;
      }
    }

    console.error('W-API status check failed', { lastErr, lastStatus });
    return new Response(
      JSON.stringify({
        error: 'Não foi possível verificar o status na W-API',
        lastStatus,
        details: lastErr instanceof Error ? lastErr.message : String(lastErr),
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
