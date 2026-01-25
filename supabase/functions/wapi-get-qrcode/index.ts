import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// W-API PRO uses api.wapi.com.br exclusively
const PRO_BASE_URL = 'https://api.wapi.com.br';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION']);

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

    if (!config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ 
          error: 'Configurações W-API incompletas',
          missing: {
            token: !config.W_API_TOKEN,
            session: !config.W_API_SESSION,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    const encoded = encodeURIComponent(instanceId);

    console.log('=== W-API PRO QR Code ===');
    console.log(`PRO Base URL: ${PRO_BASE_URL}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // W-API PRO QR Code endpoint
    // Using apikey header (not Bearer Authorization)
    const qrCodeUrl = `${PRO_BASE_URL}/qr-code?instanceId=${encoded}&image=enable`;
    
    console.log('Fetching QR Code from:', qrCodeUrl);
    
    const response = await fetch(qrCodeUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json, image/png, image/*, */*',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    
    console.log('W-API response status:', response.status, 'content-type:', contentType);

    // Handle image response (when image=enable returns PNG directly)
    if (contentType.includes('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUri = `data:${contentType};base64,${base64}`;
      
      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'pending',
          qrcode: dataUri,
          message: 'QR Code gerado com sucesso'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle JSON response
    const rawBody = await response.text();
    let responseData: any = null;
    
    try {
      responseData = JSON.parse(rawBody);
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      console.error('W-API QR Code error:', {
        status: response.status,
        contentType,
        bodyPreview: rawBody.slice(0, 300),
        parsed: responseData,
      });
      
      // Check if already connected
      if (responseData?.status === 'CONNECTED' || responseData?.connected || responseData?.instance?.state === 'open') {
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

    // Check if already connected
    if (responseData.status === 'CONNECTED' || responseData.connected || responseData.instance?.state === 'open') {
      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'connected',
          message: 'WhatsApp já está conectado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract QR code from various possible response formats
    const qrCode = responseData.qrcode || 
                   responseData.qr || 
                   responseData.base64 ||
                   responseData.qrcode_url ||
                   responseData.qr_url ||
                   responseData.data?.qrcode ||
                   responseData.data?.qr ||
                   responseData.data?.base64;

    return new Response(
      JSON.stringify({ 
        success: true,
        status: responseData.status || 'pending',
        qrcode: qrCode,
        qrcode_url: responseData.qrcode_url || responseData.qr_url || responseData.data?.qrcode_url,
        message: responseData.message || 'QR Code gerado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting QR code:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao obter QR Code', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
