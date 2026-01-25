import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');

    // Build chatId in W-API format
    const chatId = `${formattedPhone}@${isGroup ? 'g.us' : 'c.us'}`;

    console.log('=== W-API Send Message ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`Phone: ${formattedPhone}`);
    console.log(`ChatId: ${chatId}`);
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

    // Build the correct W-API PRO endpoint: /{instanceId}/send-text
    const sendUrl = `${baseUrl}/${instanceId}/send-text`;
    
    // Build request body based on message type
    let requestBody: Record<string, unknown>;
    let endpoint = sendUrl;
    
    if (mediaUrl && mediaType) {
      // For media, use the appropriate endpoint
      const mediaCaption = caption || message || '';
      
      switch (mediaType) {
        case 'image':
          endpoint = `${baseUrl}/${instanceId}/send-image`;
          requestBody = { chatId, image: mediaUrl, caption: mediaCaption };
          break;
        case 'document':
          endpoint = `${baseUrl}/${instanceId}/send-document`;
          requestBody = { chatId, document: mediaUrl, fileName: fileName || 'documento.pdf', caption: mediaCaption };
          break;
        case 'video':
          endpoint = `${baseUrl}/${instanceId}/send-video`;
          requestBody = { chatId, video: mediaUrl, caption: mediaCaption };
          break;
        case 'audio':
          endpoint = `${baseUrl}/${instanceId}/send-audio`;
          requestBody = { chatId, audio: mediaUrl };
          break;
        default:
          endpoint = sendUrl;
          requestBody = { chatId, text: message };
      }
    } else {
      // Text message - use chatId and text as per W-API PRO docs
      requestBody = { chatId, text: message };
    }

    console.log(`Calling: POST ${endpoint}`);
    console.log(`Body: ${JSON.stringify(requestBody)}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
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
