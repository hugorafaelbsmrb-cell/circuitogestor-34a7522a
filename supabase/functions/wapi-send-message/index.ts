import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Default W-API URL
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface SendMessageRequest {
  phone: string;
  message: string;
  isGroup?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  fileName?: string;
  caption?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with service role key for database operations
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

    // Get W-API config from app_settings
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

    const { phone, message, isGroup = false, mediaUrl, mediaType, fileName, caption }: SendMessageRequest = await req.json();

    if (!phone || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: 'Telefone e mensagem ou mídia são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number - clean and ensure 55 prefix
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const apiToken = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');

    console.log('=== W-API Send Message ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`Phone: ${formattedPhone}`);
    console.log(`Media Type: ${mediaType || 'text'}`);

    const messageContent = message || caption || `[${mediaType || 'media'}]`;
    const dbMediaType = mediaType || null;

    // Save message BEFORE sending (resilience pattern)
    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: formattedPhone,
        message: messageContent,
        direction: 'outgoing',
        status: 'pending',
        media_url: mediaUrl || null,
        media_type: dbMediaType,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('Error saving outgoing message:', saveError);
    }

    const savedMsgId = savedMsg?.id;

    // Build request using the correct W-API format from documentation:
    // URL: https://api.w-api.app/v1/message/send-text?instanceId={{INSTANCE_ID}}
    // Headers: Authorization: Bearer {{TOKEN}}, Content-Type: application/json
    const encodedInstanceId = encodeURIComponent(instanceId);
    
    let endpoint: string;
    let requestBody: Record<string, unknown>;
    
    if (mediaUrl && mediaType) {
      const mediaCaption = caption || message || '';
      
      switch (mediaType) {
        case 'image':
          endpoint = `${baseUrl}/v1/message/send-image?instanceId=${encodedInstanceId}`;
          requestBody = { 
            phone: formattedPhone, 
            image: mediaUrl, 
            caption: mediaCaption,
            isGroup 
          };
          break;
        case 'document':
          endpoint = `${baseUrl}/v1/message/send-document?instanceId=${encodedInstanceId}`;
          requestBody = { 
            phone: formattedPhone, 
            document: mediaUrl, 
            fileName: fileName || 'documento.pdf', 
            caption: mediaCaption,
            isGroup 
          };
          break;
        case 'video':
          endpoint = `${baseUrl}/v1/message/send-video?instanceId=${encodedInstanceId}`;
          requestBody = { 
            phone: formattedPhone, 
            video: mediaUrl, 
            caption: mediaCaption,
            isGroup 
          };
          break;
        case 'audio':
          endpoint = `${baseUrl}/v1/message/send-audio?instanceId=${encodedInstanceId}`;
          requestBody = { 
            phone: formattedPhone, 
            audio: mediaUrl,
            isGroup 
          };
          break;
        default:
          endpoint = `${baseUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`;
          requestBody = { 
            phone: formattedPhone, 
            message: message,
            isGroup 
          };
      }
    } else {
      // Text message - use documented format
      endpoint = `${baseUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`;
      requestBody = { 
        phone: formattedPhone, 
        message: message,
        isGroup 
      };
    }

    console.log(`Calling: POST ${endpoint}`);
    console.log(`Body: ${JSON.stringify(requestBody)}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`Response ${response.status}: ${responseText.slice(0, 500)}`);

    // deno-lint-ignore no-explicit-any
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Non-JSON response from W-API');
    }

    if (response.ok) {
      console.log('Message sent successfully');
      
      const wapiMessageId = (parsed?.id || parsed?.key?.id || parsed?.messageId || null) as string | null;
      if (savedMsgId) {
        await supabase
          .from('whatsapp_messages')
          .update({ 
            status: 'sent',
            wapi_message_id: wapiMessageId,
          })
          .eq('id', savedMsgId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Mensagem enviada com sucesso',
          data: parsed,
          endpoint,
          messageId: savedMsgId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request failed
    console.error('W-API request failed:', { status: response.status, body: parsed });
    
    if (savedMsgId) {
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed' })
        .eq('id', savedMsgId);
    }

    return new Response(
      JSON.stringify({
        error: 'Erro na W-API',
        status: response.status,
        details: parsed,
        endpoint,
        messageId: savedMsgId,
      }),
      { status: response.status >= 400 && response.status < 600 ? response.status : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-send-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
