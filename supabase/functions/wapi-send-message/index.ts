import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default W-API URL (can be overridden by app_settings)
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface SendMessageRequest {
  phone: string;
  message: string;
  isGroup?: boolean;
  // Media fields
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

    // Parse request body
    const { phone, message, isGroup = false, mediaUrl, mediaType, fileName, caption }: SendMessageRequest = await req.json();

    if (!phone || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: 'Telefone e mensagem ou mídia são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits, ensure country code)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    // Use W_API_URL from database or default to api.w-api.app
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const encoded = encodeURIComponent(instanceId);

    console.log('=== W-API Send Message ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`Phone: ${formattedPhone}`);
    console.log(`Media Type: ${mediaType || 'text'}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    // Determine message type for DB storage
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

    // Build candidates based on message type
    // W-API uses /api/send with instance_id and access_token in body
    const candidates: Array<{
      url: string;
      body: Record<string, unknown>;
      description: string;
    }> = [];

    const chatId = `${formattedPhone}@c.us`;

    if (mediaUrl && mediaType) {
      // MEDIA MESSAGE ENDPOINTS
      const mediaCaption = caption || message || '';

      switch (mediaType) {
        case 'image':
          candidates.push(
            // W-API unified /api/send endpoint with type
            {
              url: `${baseUrl}/api/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                number: formattedPhone, 
                type: 'image',
                message: mediaCaption,
                media_url: mediaUrl,
              },
              description: 'api/send image',
            },
            // Alternative with chatId
            {
              url: `${baseUrl}/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                chatId,
                text: mediaCaption,
                file: { url: mediaUrl },
              },
              description: 'send with file object',
            },
            // Legacy sendImage
            {
              url: `${baseUrl}/sendImage?instanceId=${encoded}`,
              body: { phone: formattedPhone, image: mediaUrl, caption: mediaCaption, isGroup },
              description: 'sendImage legacy',
            }
          );
          break;

        case 'document':
          const docFileName = fileName || 'documento.pdf';
          candidates.push(
            {
              url: `${baseUrl}/api/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                number: formattedPhone, 
                type: 'document',
                message: mediaCaption,
                media_url: mediaUrl,
                filename: docFileName,
              },
              description: 'api/send document',
            },
            {
              url: `${baseUrl}/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                chatId,
                text: mediaCaption,
                file: { url: mediaUrl },
              },
              description: 'send with file object',
            },
            {
              url: `${baseUrl}/sendDocument?instanceId=${encoded}`,
              body: { phone: formattedPhone, document: mediaUrl, fileName: docFileName, caption: mediaCaption },
              description: 'sendDocument legacy',
            }
          );
          break;

        case 'video':
          candidates.push(
            {
              url: `${baseUrl}/api/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                number: formattedPhone, 
                type: 'video',
                message: mediaCaption,
                media_url: mediaUrl,
              },
              description: 'api/send video',
            },
            {
              url: `${baseUrl}/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                chatId,
                text: mediaCaption,
                file: { url: mediaUrl },
              },
              description: 'send with file object',
            },
            {
              url: `${baseUrl}/sendVideo?instanceId=${encoded}`,
              body: { phone: formattedPhone, video: mediaUrl, caption: mediaCaption },
              description: 'sendVideo legacy',
            }
          );
          break;

        case 'audio':
          candidates.push(
            {
              url: `${baseUrl}/api/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                number: formattedPhone, 
                type: 'audio',
                media_url: mediaUrl,
              },
              description: 'api/send audio',
            },
            {
              url: `${baseUrl}/send`,
              body: { 
                instance_id: instanceId, 
                access_token: apiKey, 
                chatId,
                file: { url: mediaUrl },
              },
              description: 'send with file object',
            },
            {
              url: `${baseUrl}/sendAudio?instanceId=${encoded}`,
              body: { phone: formattedPhone, audio: mediaUrl },
              description: 'sendAudio legacy',
            }
          );
          break;
      }
    } else {
      // TEXT MESSAGE ENDPOINTS
      // W-API unified /api/send endpoint
      candidates.push(
        {
          url: `${baseUrl}/api/send`,
          body: { 
            instance_id: instanceId, 
            access_token: apiKey, 
            number: formattedPhone, 
            type: 'text',
            message: message,
          },
          description: 'api/send text',
        },
        // Alternative /send endpoint
        {
          url: `${baseUrl}/send`,
          body: { 
            instance_id: instanceId, 
            access_token: apiKey, 
            chatId,
            text: message,
          },
          description: 'send with chatId',
        },
        // V1 api/send
        {
          url: `${baseUrl}/v1/api/send`,
          body: { 
            instance_id: instanceId, 
            access_token: apiKey, 
            number: formattedPhone, 
            type: 'text',
            message: message,
          },
          description: 'v1/api/send text',
        },
        // Legacy sendText with instanceId in query
        {
          url: `${baseUrl}/sendText?instanceId=${encoded}`,
          body: { phone: formattedPhone, message, isGroup },
          description: 'sendText legacy',
        }
      );
    }

    let lastError: string | null = null;
    let lastStatus: number | null = null;
    const attempts: Array<{ url: string; status: number | null; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      try {
        console.log(`Trying: POST ${c.url}`);
        
        const res = await fetch(c.url, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(c.body),
        });

        lastStatus = res.status;
        const text = await res.text();
        console.log(`Response ${res.status}: ${text.slice(0, 200)}`);
        
        attempts.push({ url: c.url, status: res.status, ok: res.ok });

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          attempts[attempts.length - 1].error = 'Non-JSON response';
          continue;
        }

        if (res.ok) {
          console.log('Message sent successfully via:', c.url);
          
          // Update message status to 'sent'
          const wapiMessageId = parsed?.id || parsed?.key?.id || parsed?.messageId || null;
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
              endpoint: c.url,
              messageId: savedMsgId,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastError = parsed?.message || parsed?.error || JSON.stringify(parsed);
        attempts[attempts.length - 1].error = lastError || undefined;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        attempts.push({ url: c.url, status: null, ok: false, error: errMsg });
        lastError = errMsg;
      }
    }

    console.error('All W-API send endpoints failed:', { attempts, lastStatus, lastError });
    
    // Update message status to 'failed'
    if (savedMsgId) {
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed' })
        .eq('id', savedMsgId);
    }

    return new Response(
      JSON.stringify({
        error: 'Não foi possível enviar mensagem via W-API',
        lastStatus,
        details: lastError,
        attempts,
        messageId: savedMsgId,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
