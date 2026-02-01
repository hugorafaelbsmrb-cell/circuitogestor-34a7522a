import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Default W-API URL
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // CRITICAL: Validate JWT using getClaims for Lovable Cloud ES256 tokens
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('JWT validation failed:', claimsError?.message || 'No claims found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Invalid or expired token' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('User authenticated:', claimsData.claims.email);

    // Fetch W-API configuration from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse settings into config object
    const config: Record<string, string> = {};
    settings?.forEach((s) => {
      if (s.value) config[s.key] = s.value;
    });

    // Validate required settings
    if (!config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({
          error: 'Configurações W-API incompletas',
          missing: { token: !config.W_API_TOKEN, session: !config.W_API_SESSION },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const encodedInstanceId = encodeURIComponent(instanceId);

    console.log('=== W-API Get QR Code ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO endpoint for QR code
    // Endpoint: GET /v1/instance/qr-code?instanceId={INSTANCE_ID}&image=enable
    // Auth: Authorization: Bearer {TOKEN}
    const qrCodeUrl = `${baseUrl}/v1/instance/qr-code?instanceId=${encodedInstanceId}&image=enable`;

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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No QR code found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'QR Code não disponível',
        raw: parsed,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in wapi-get-qrcode:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
