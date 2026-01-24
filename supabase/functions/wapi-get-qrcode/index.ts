import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get QR Code from W-API
    // The W-API uses query parameters for authentication on the get_qrcode endpoint
    // Per official docs: https://app.wawp.net/api/get_qrcode?instance_id=...&access_token=...
    let wapiUrl = (config.W_API_URL || 'https://wawp.net/api').trim();
    // Garantir HTTPS
    wapiUrl = wapiUrl.replace(/^http:\/\//i, 'https://');
    // Remover barras finais duplicadas
    wapiUrl = wapiUrl.replace(/\/+$/, '');
    // Garantir que termina com /api (sem duplicar)
    if (!wapiUrl.endsWith('/api')) {
      wapiUrl = wapiUrl.includes('/api') ? wapiUrl : `${wapiUrl}/api`;
    }
    
    // Build URL with query parameters as per W-API documentation
    const qrCodeUrl = `${wapiUrl}/get_qrcode?instance_id=${encodeURIComponent(config.W_API_SESSION)}&access_token=${encodeURIComponent(config.W_API_TOKEN)}`;
    
    console.log('Fetching QR Code from:', qrCodeUrl.replace(config.W_API_TOKEN, '***'));
    
    const fetchOptions = {
      headers: {
        'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
    } as const;

    // Docs call this "POST", but many providers serve it as GET.
    let response = await fetch(qrCodeUrl, { method: 'GET', ...fetchOptions });
    if (!response.ok) {
      // Fallback to POST in case the provider expects it.
      response = await fetch(qrCodeUrl, { method: 'POST', ...fetchOptions });
    }

    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();

    let responseData: any = null;
    if (contentType.includes('application/json')) {
      try {
        responseData = JSON.parse(rawBody);
      } catch {
        responseData = null;
      }
    } else {
      // Some providers respond with text/json but wrong content-type.
      try {
        responseData = JSON.parse(rawBody);
      } catch {
        responseData = null;
      }
    }

    if (!response.ok) {
      console.error('W-API QR Code error:', {
        status: response.status,
        contentType,
        bodyPreview: rawBody.slice(0, 300),
        parsed: responseData,
      });
      
      // Check if already connected
      if (responseData?.status === 'CONNECTED' || responseData?.connected) {
        return new Response(
          JSON.stringify({ 
            success: true,
            status: 'connected',
            message: 'WhatsApp já está conectado'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao obter QR Code',
          details: responseData || {
            status: response.status,
            contentType,
            bodyPreview: rawBody.slice(0, 500),
            hint: 'O provedor retornou HTML/texto em vez de JSON. Confira se a URL base está correta e se o endpoint /get_qrcode existe no seu provedor.'
          }
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!responseData) {
      console.error('W-API QR Code: expected JSON but got non-JSON response', {
        status: response.status,
        contentType,
        bodyPreview: rawBody.slice(0, 300),
      });
      return new Response(
        JSON.stringify({
          error: 'Resposta inválida do provedor W-API',
          details: {
            status: response.status,
            contentType,
            bodyPreview: rawBody.slice(0, 500),
          }
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('QR Code response:', responseData);

    // Return QR code data
    return new Response(
      JSON.stringify({ 
        success: true,
        status: responseData.status || 'pending',
        qrcode: responseData.qrcode || responseData.qr || responseData.data?.qrcode,
        qrcode_url: responseData.qrcode_url || responseData.qr_url || responseData.data?.qrcode_url,
        message: responseData.message || 'QR Code gerado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting QR code:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao obter QR Code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
