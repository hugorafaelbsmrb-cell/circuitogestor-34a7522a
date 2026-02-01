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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Create client with service role and verify the user token
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user by passing their JWT token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('Auth verification failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Invalid or expired session' }), {
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

    console.log('=== W-API Get QR Code ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO endpoint for QR code
    // Auth: Authorization: Bearer {{TOKEN}}
    const qrCodeUrl = `${baseUrl}/v1/instance/qr-code?instanceId=${encoded}&image=enable`;

    console.log(`Calling: GET ${qrCodeUrl}`);

    const response = await fetch(qrCodeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json, image/*',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    console.log(`Response ${response.status}, Content-Type: ${contentType}`);

    // If response is an image, convert to base64 data URI
    if (contentType.startsWith('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = contentType.split(';')[0];
      const dataUri = `data:${mimeType};base64,${base64}`;

      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          qrcode: dataUri,
          message: 'Escaneie o QR Code com seu WhatsApp',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse JSON response
    const text = await response.text();
    console.log(`Response body: ${text.slice(0, 500)}`);

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Failed to parse response as JSON');
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: parsed?.message || parsed?.error || 'Erro ao obter QR Code',
          status: response.status,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if already connected
    const state = parsed?.state || parsed?.status || '';
    const stateLower = String(state).toLowerCase();
    if (stateLower === 'connected' || stateLower === 'open') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'connected',
          message: 'WhatsApp já está conectado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Extract QR code from JSON response
    const qrcode = parsed?.qrcode || parsed?.qr || parsed?.base64 || parsed?.data?.qrcode || null;

    if (qrcode) {
      // Ensure proper data URI format
      const qrDataUri = qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`;
      
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          qrcode: qrDataUri,
          message: 'Escaneie o QR Code com seu WhatsApp',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // No QR code found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'QR Code não disponível',
        raw: parsed,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in wapi-get-qrcode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
