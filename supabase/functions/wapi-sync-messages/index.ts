import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config
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

    // ========================================
    // W-API CONFIGURATION
    // Base URL: https://api.w-api.app/v1/
    // Documented endpoints for W-API PRO
    // ========================================
    
    // Normalize configured URL - ensure /v1 suffix
    let baseUrl = (config.W_API_URL || 'https://api.w-api.app/v1').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = `https://${baseUrl}`;
    }
    // Ensure /v1 is present
    if (!baseUrl.includes('/v1')) {
      baseUrl = baseUrl + '/v1';
    }
    
    const apiToken = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;

    console.log(`Using base URL: ${baseUrl}`);
    console.log(`Instance ID: ${instanceId}`);

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

    // ========================================
    // FETCH MESSAGES - W-API v1 endpoints
    // Documentation: https://api.w-api.app/v1/
    // ========================================
    type EndpointCandidate = {
      url: string;
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body?: string;
      note: string;
    };

    const fetchMessagesForPhone = async (chatId: string): Promise<{ messages: WapiMessage[]; workingEndpoint?: string }> => {
      // Build list of endpoint candidates based on W-API v1 documentation
      const candidates: EndpointCandidate[] = [];

      // Pattern 1: POST /chat/send/getMessages (W-API v1 documented)
      candidates.push({
        url: `${baseUrl}/chat/send/getMessages/${instanceId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /chat/send/getMessages/{instance}',
      });

      // Pattern 2: GET /chat/messages/{instance}
      candidates.push({
        url: `${baseUrl}/chat/messages/${instanceId}?chatId=${encodeURIComponent(chatId)}&count=20`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        note: 'GET /chat/messages/{instance}',
      });

      // Pattern 3: POST /messages/getMessages/{instance}
      candidates.push({
        url: `${baseUrl}/messages/getMessages/${instanceId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /messages/getMessages/{instance}',
      });

      // Pattern 4: GET /chats/list/{instance} - to get chat list first
      candidates.push({
        url: `${baseUrl}/chats/${instanceId}?chatId=${encodeURIComponent(chatId)}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        note: 'GET /chats/{instance}',
      });

      // Pattern 5: POST /chat/getMessages (alternative path)
      candidates.push({
        url: `${baseUrl}/chat/getMessages/${instanceId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /chat/getMessages/{instance}',
      });

      // Pattern 6: GET with all params in query
      candidates.push({
        url: `${baseUrl}/messages/${instanceId}?chatId=${encodeURIComponent(chatId)}&limit=20`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        note: 'GET /messages/{instance}',
      });

      // Pattern 7: Alternative with apikey header instead of Bearer
      candidates.push({
        url: `${baseUrl}/chat/send/getMessages/${instanceId}`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /chat/send/getMessages (apikey header)',
      });

      for (const candidate of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const fetchOptions: RequestInit = {
            method: candidate.method,
            headers: candidate.headers,
            signal: controller.signal,
          };
          
          if (candidate.body) {
            fetchOptions.body = candidate.body;
          }

          const response = await fetch(candidate.url, fetchOptions);
          clearTimeout(timeoutId);

          if (response.ok) {
            const text = await response.text();
            console.log(`SUCCESS with ${candidate.note}: status=${response.status}, preview=${text.slice(0, 150)}`);
            
            try {
              const data = JSON.parse(text);
              
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
                console.log(`Found ${messages.length} messages using: ${candidate.note}`);
                return { messages: messages.slice(0, 20), workingEndpoint: candidate.note };
              }
            } catch (parseErr) {
              console.log(`Parse error for ${candidate.note}: ${parseErr}`);
            }
          } else {
            const errText = await response.text();
            // Only log first few characters to avoid spam
            console.log(`${candidate.note}: ${response.status} - ${errText.slice(0, 80)}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Don't log timeout errors to reduce noise
          if (!msg.includes('abort')) {
            console.log(`${candidate.note}: ${msg.slice(0, 60)}`);
          }
        }
      }

      return { messages: [] };
    };

    // ========================================
    // PROCESS GUARDIANS
    // ========================================
    const debugInfo: Array<{ phoneSuffix: string; chatId: string; messagesFound: number; endpoint?: string }> = [];
    let guardiansWithMessages = 0;
    let workingEndpointFound: string | undefined;

    for (const guardian of guardians) {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) continue;
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);

      const chatId = `${phone}@c.us`;
      
      const { messages, workingEndpoint } = await fetchMessagesForPhone(chatId);
      
      if (workingEndpoint && !workingEndpointFound) {
        workingEndpointFound = workingEndpoint;
      }
      
      // Store debug info for first 5 phones
      if (debugInfo.length < 5) {
        debugInfo.push({
          phoneSuffix: phone.slice(-4),
          chatId,
          messagesFound: messages.length,
          endpoint: workingEndpoint,
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

    console.log(`Sync complete: ${syncedCount} messages, ${errorCount} errors`);
    console.log(`Guardians: ${processedPhones.size} checked, ${guardiansWithMessages} with messages`);

    // Build response message
    let message = `Sincronização concluída: ${syncedCount} mensagens importadas`;
    if (guardiansWithMessages === 0 && syncedCount === 0) {
      message = 'Nenhuma mensagem encontrada. Verifique se a instância está conectada e há histórico de conversa.';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        synced: syncedCount,
        errors: errorCount,
        guardiansProcessed: processedPhones.size,
        guardiansWithMessages,
        workingEndpoint: workingEndpointFound,
        debug: syncedCount === 0 ? {
          baseUrl,
          instanceId: instanceId.slice(0, 8) + '...',
          samples: debugInfo,
        } : undefined,
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
