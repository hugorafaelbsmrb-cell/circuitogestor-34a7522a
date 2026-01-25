import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default W-API URL (can be overridden by app_settings)
const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface WapiMessage {
  id?: { _serialized?: string } | string;
  key?: { id?: string; fromMe?: boolean };
  body?: string;
  text?: string;
  message?: string;
  content?: string;
  fromMe?: boolean;
  timestamp?: number;
  t?: number;
  type?: string;
  hasMedia?: boolean;
  mediaUrl?: string;
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

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config
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

    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;
    // Use W_API_URL from database or default to api.w-api.app
    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');

    console.log('=== W-API Sync Started ===');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);
    console.log(`API Key: ${apiKey.slice(0, 8)}...`);

    let syncedCount = 0;
    let errorCount = 0;
    const processedPhones = new Set<string>();

    // Load guardians
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, phone, name')
      .limit(500);

    if (!guardians || guardians.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum responsável cadastrado para sincronizar',
          synced: 0,
          errors: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Found ${guardians.length} guardians to sync`);

    // Normalize phone to BR format with country code
    const normalizeToBR = (raw: string) => {
      const digits = (raw || '').replace(/\D/g, '');
      if (!digits) return '';
      return digits.startsWith('55') ? digits : `55${digits}`;
    };

    // W-API PRO endpoints to try for getting messages
    // The API may require instanceId in different positions
    const getMessageEndpoints = (chatId: string) => [
      // Format 1: /chat/getMessages with query params
      `${baseUrl}/chat/getMessages/${instanceId}?chatId=${encodeURIComponent(chatId)}&count=20`,
      // Format 2: /v1/chat/messages with instanceId
      `${baseUrl}/v1/chat/messages/${instanceId}?chatId=${encodeURIComponent(chatId)}&limit=20`,
      // Format 3: Instance-based path
      `${baseUrl}/instance/${instanceId}/getMessages?chatId=${encodeURIComponent(chatId)}&count=20`,
      // Format 4: Direct chatId path with GET
      `${baseUrl}/chat/${instanceId}/${encodeURIComponent(chatId)}/messages?limit=20`,
      // Format 5: Simple v1 messages endpoint
      `${baseUrl}/v1/messages/${instanceId}?chatId=${encodeURIComponent(chatId)}&count=20`,
    ];
    
    const fetchMessagesForPhone = async (chatId: string): Promise<{ messages: WapiMessage[]; status: number; error?: string }> => {
      const endpoints = getMessageEndpoints(chatId);
      
      // Try each endpoint until one works
      for (const url of endpoints) {
        console.log(`Trying: GET ${url}`);
        console.log(`Headers: apikey=${apiKey.slice(0, 8)}...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          const responseText = await response.text();
          console.log(`Response status: ${response.status}`);
          console.log(`Response preview: ${responseText.slice(0, 150)}`);

          // If we get 404, try next endpoint
          if (response.status === 404) {
            continue;
          }

          if (!response.ok) {
            // Try next endpoint for other errors too
            if (response.status >= 400 && response.status < 500) {
              continue;
            }
            return { 
              messages: [], 
              status: response.status, 
              error: responseText.slice(0, 100) 
            };
          }

          try {
            const data = JSON.parse(responseText);
            
            // Extract messages from various response structures
            let messages: WapiMessage[] = [];
            
            if (Array.isArray(data)) {
              messages = data;
            } else if (data.messages && Array.isArray(data.messages)) {
              messages = data.messages;
            } else if (data.data?.messages && Array.isArray(data.data.messages)) {
              messages = data.data.messages;
            } else if (data.data && Array.isArray(data.data)) {
              messages = data.data;
            } else if (data.result && Array.isArray(data.result)) {
              messages = data.result;
            } else if (data.response && Array.isArray(data.response)) {
              messages = data.response;
            }
            
            if (messages.length > 0) {
              console.log(`SUCCESS! Found ${messages.length} messages from ${url}`);
              return { messages: messages.slice(0, 20), status: response.status };
            }
            
          } catch (parseErr) {
            console.error(`JSON parse error: ${parseErr}`);
            continue;
          }
          
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Fetch error for ${url}: ${msg}`);
          
          if (msg.includes('abort')) {
            continue; // Try next endpoint on timeout
          }
          
          continue; // Try next endpoint on error
        }
      }
      
      // All endpoints failed
      return { 
        messages: [], 
        status: 404, 
        error: 'Nenhum endpoint de mensagens disponível. Sincronização via webhook ativa.' 
      };
    };

    // Process guardians
    const debugInfo: Array<{ phoneSuffix: string; chatId: string; messagesFound: number; status: number; error?: string }> = [];
    let guardiansWithMessages = 0;
    let lastStatus = 0;
    let lastError: string | undefined;

    for (const guardian of guardians) {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) continue;
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);

      const chatId = `${phone}@c.us`;
      
      const { messages, status, error } = await fetchMessagesForPhone(chatId);
      
      lastStatus = status;
      lastError = error;
      
      // Store debug info for first 5 phones
      if (debugInfo.length < 5) {
        debugInfo.push({
          phoneSuffix: phone.slice(-4),
          chatId,
          messagesFound: messages.length,
          status,
          error,
        });
      }

      if (messages.length === 0) continue;
      
      guardiansWithMessages++;

      // Insert messages
      for (const msg of messages) {
        const messageId = typeof msg.id === 'object' ? msg.id?._serialized : msg.id || msg.key?.id || null;
        const messageText = msg.body || msg.text || msg.message || msg.content || '';
        const isFromMe = msg.fromMe || msg.key?.fromMe || false;
        const timestamp = msg.timestamp || msg.t || null;

        if (!messageText && !msg.hasMedia) continue;

        // Check if already exists
        if (messageId) {
          const { data: existing } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('wapi_message_id', messageId)
            .maybeSingle();

          if (existing) continue;
        }

        const { error: insertError } = await supabase
          .from('whatsapp_messages')
          .insert({
            guardian_id: guardian.id,
            phone,
            message: messageText || '[Mídia]',
            direction: isFromMe ? 'outgoing' : 'incoming',
            status: isFromMe ? 'sent' : 'received',
            wapi_message_id: messageId,
            media_type: msg.type || null,
            media_url: msg.mediaUrl || null,
            created_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          });

        if (insertError) {
          console.log(`Insert error: ${insertError.message}`);
          errorCount++;
        } else {
          syncedCount++;
        }
      }
    }

    console.log(`=== Sync Complete ===`);
    console.log(`Messages synced: ${syncedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Guardians: ${processedPhones.size} checked, ${guardiansWithMessages} with messages`);

    // Build response message
    let message = `Sincronização concluída: ${syncedCount} mensagens importadas`;
    
    if (guardiansWithMessages === 0 && syncedCount === 0) {
      if (lastStatus === 404 || lastError?.includes('endpoint')) {
        // This is expected for some W-API configurations - webhook is the primary sync method
        message = 'Sincronização manual não disponível para esta instância. As mensagens são capturadas automaticamente via webhook em tempo real.';
      } else if (lastStatus === 401 || lastStatus === 403) {
        message = 'Erro de autenticação. Verifique se a API Key está correta no painel W-API.';
      } else if (lastStatus === 408 || lastError?.includes('Timeout')) {
        message = 'Timeout na conexão. O servidor W-API pode estar sobrecarregado. Tente novamente em alguns minutos.';
      } else if (lastError) {
        message = `Erro na conexão: ${lastError}. Verifique as configurações no painel W-API.`;
      } else {
        message = 'Nenhuma mensagem encontrada. As mensagens são capturadas automaticamente via webhook quando recebidas.';
      }
    }

    return new Response(
      JSON.stringify({
        success: syncedCount > 0 || errorCount === 0,
        message,
        synced: syncedCount,
        errors: errorCount,
        guardiansProcessed: processedPhones.size,
        guardiansWithMessages,
        debug: {
          baseUrl,
          instanceId: instanceId.slice(0, 8) + '...',
          lastStatus,
          lastError,
          samples: debugInfo,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
