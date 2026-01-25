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

    // Format phone number
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const apiKey = config.W_API_TOKEN;
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

    const candidates: Array<{
      url: string;
      body: Record<string, unknown>;
      description: string;
    }> = [];

    const chatId = `${formattedPhone}@${isGroup ? 'g.us' : 'c.us'}`;

    if (mediaUrl && mediaType) {
      const mediaCaption = caption || message || '';

      // NOTE: Media endpoints vary a lot between W-API vendors/versions.
      // We keep the legacy candidates below (and can extend once you confirm the provider's media route).

      // Legacy fallbacks that some deployments expose
      switch (mediaType) {
        case 'image':
          candidates.push(
            {
              url: `${baseUrl}/v1/messages/image?instanceId=${instanceId}`,
              body: { phone: formattedPhone, image: mediaUrl, caption: mediaCaption, isGroup },
              description: 'legacy v1/messages/image',
            },
            {
              url: `${baseUrl}/messages/image?instanceId=${instanceId}`,
              body: { phone: formattedPhone, image: mediaUrl, caption: mediaCaption },
              description: 'legacy messages/image',
            }
          );
          break;
        case 'document':
          candidates.push(
            {
              url: `${baseUrl}/v1/messages/document?instanceId=${instanceId}`,
              body: { phone: formattedPhone, document: mediaUrl, fileName: fileName || 'documento.pdf', caption: mediaCaption },
              description: 'legacy v1/messages/document',
            },
            {
              url: `${baseUrl}/messages/document?instanceId=${instanceId}`,
              body: { phone: formattedPhone, document: mediaUrl, fileName: fileName || 'documento.pdf', caption: mediaCaption },
              description: 'legacy messages/document',
            }
          );
          break;
        case 'video':
          candidates.push(
            {
              url: `${baseUrl}/v1/messages/video?instanceId=${instanceId}`,
              body: { phone: formattedPhone, video: mediaUrl, caption: mediaCaption },
              description: 'legacy v1/messages/video',
            },
            {
              url: `${baseUrl}/messages/video?instanceId=${instanceId}`,
              body: { phone: formattedPhone, video: mediaUrl, caption: mediaCaption },
              description: 'legacy messages/video',
            }
          );
          break;
        case 'audio':
          candidates.push(
            {
              url: `${baseUrl}/v1/messages/audio?instanceId=${instanceId}`,
              body: { phone: formattedPhone, audio: mediaUrl },
              description: 'legacy v1/messages/audio',
            },
            {
              url: `${baseUrl}/messages/audio?instanceId=${instanceId}`,
              body: { phone: formattedPhone, audio: mediaUrl },
              description: 'legacy messages/audio',
            }
          );
          break;
      }
    } else {
      // Primary (known-working in this repo): /message/send-text with Bearer token + session in body
      candidates.push(
        {
          url: `${baseUrl}/message/send-text`,
          body: { session: instanceId, phone: formattedPhone, message, isGroup },
          description: 'message/send-text (repo-proven)',
        },
        // Common variants
        {
          url: `${baseUrl}/message/sendText`,
          body: { session: instanceId, phone: formattedPhone, message, isGroup },
          description: 'message/sendText',
        },
        {
          url: `${baseUrl}/message/sendText/${encodeURIComponent(instanceId)}`,
          body: { phone: formattedPhone, message, isGroup },
          description: 'message/sendText/:session',
        },
        {
          url: `${baseUrl}/message/send-text`,
          body: { session: instanceId, phone: formattedPhone, text: message, isGroup },
          description: 'message/send-text (text field)',
        }
      );

      // Other fallbacks (older W-API shapes)
      candidates.push(
        {
          url: `${baseUrl}/v1/messages/text?instanceId=${instanceId}`,
          body: { phone: formattedPhone, message, isGroup },
          description: 'legacy v1/messages/text phone',
        },
        {
          url: `${baseUrl}/v1/messages/text?instanceId=${instanceId}`,
          body: { chatId, message },
          description: 'legacy v1/messages/text chatId',
        },
        {
          url: `${baseUrl}/messages/text?instanceId=${instanceId}`,
          body: { phone: formattedPhone, message, isGroup },
          description: 'legacy messages/text',
        },
        {
          url: `${baseUrl}/sendText?instanceId=${instanceId}`,
          body: { phone: formattedPhone, message, isGroup },
          description: 'legacy sendText',
        }
      );
    }

    let lastError: string | null = null;
    let lastStatus: number | null = null;
    const attempts: Array<{ url: string; status: number | null; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      try {
        console.log(`Trying: POST ${c.url}`);
        console.log(`Body: ${JSON.stringify(c.body)}`);
        
        const res = await fetch(c.url, {
          method: 'POST',
          headers: {
            // This project already uses Bearer auth for W-API in other backend functions.
            // We also include apikey for compatibility with older variants.
            'Authorization': `Bearer ${apiKey}`,
            'apikey': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(c.body),
        });

        lastStatus = res.status;
        const text = await res.text();
        console.log(`Response ${res.status}: ${text.slice(0, 500)}`);
        
        attempts.push({ url: c.url, status: res.status, ok: res.ok });

        // deno-lint-ignore no-explicit-any
        let parsed: any = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          attempts[attempts.length - 1].error = 'Non-JSON response';
          continue;
        }

        if (res.ok) {
          console.log('Message sent successfully via:', c.url);
          
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
              endpoint: c.url,
              messageId: savedMsgId,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastError = (parsed?.message || parsed?.error || JSON.stringify(parsed)) as string;
        attempts[attempts.length - 1].error = lastError || undefined;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        attempts.push({ url: c.url, status: null, ok: false, error: errMsg });
        lastError = errMsg;
      }
    }

    console.error('All W-API send endpoints failed:', { attempts, lastStatus, lastError });
    
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