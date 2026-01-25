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
    // W-API PRO CONFIGURATION
    // IMPORTANT: api.w-api.app = LITE version (no history retrieval)
    //            api.wapi.com.br = PRO version (supports getMessages)
    // ========================================
    
    // Normalize configured URL
    let configuredUrl = (config.W_API_URL || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(configuredUrl) && configuredUrl) {
      configuredUrl = `https://${configuredUrl}`;
    }
    // Remove /v1 suffix if present
    configuredUrl = configuredUrl.replace(/\/v1\/?$/, '');
    
    // Detect if user configured LITE domain instead of PRO
    const isLiteDomain = configuredUrl.includes('w-api.app');
    
    // PRO domain - this is what supports getMessages API
    const proBaseUrl = 'https://api.wapi.com.br';
    
    // Use PRO domain as primary, fall back to configured
    const baseUrl = isLiteDomain ? proBaseUrl : (configuredUrl || proBaseUrl);
    
    const apiToken = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;

    console.log(`W-API Config URL: ${configuredUrl}`);
    console.log(`W-API Is LITE domain: ${isLiteDomain}`);
    console.log(`W-API Using Base URL: ${baseUrl}`);
    console.log(`W-API Instance ID: ${instanceId}`);
    console.log(`W-API Using POST /getMessages with apikey header`);

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
    // FETCH MESSAGES - W-API PRO
    // Primary: POST /getMessages with apikey header and JSON body
    // Fallbacks for different W-API versions
    // ========================================
    type EndpointCandidate = {
      url: string;
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body?: string;
      note: string;
    };

    const fetchMessagesForPhone = async (chatId: string): Promise<{ messages: WapiMessage[]; workingEndpoint?: string }> => {
      const candidates: EndpointCandidate[] = [];

      // ===== PRIMARY: W-API PRO documented endpoint =====
      // POST /getMessages with apikey header and body { chatId, count }
      candidates.push({
        url: `${baseUrl}/getMessages`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /getMessages (apikey header) [PRIMARY]',
      });

      // ===== FALLBACK 1: With instanceId in body =====
      candidates.push({
        url: `${baseUrl}/getMessages`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20, instanceId }),
        note: 'POST /getMessages (with instanceId in body)',
      });

      // ===== FALLBACK 2: Instance in path =====
      candidates.push({
        url: `${baseUrl}/${instanceId}/getMessages`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /{instance}/getMessages',
      });

      // ===== FALLBACK 3: With Bearer token instead =====
      candidates.push({
        url: `${baseUrl}/getMessages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /getMessages (Bearer token)',
      });

      // ===== FALLBACK 4: api.wapi.com.br domain =====
      candidates.push({
        url: `https://api.wapi.com.br/getMessages`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST api.wapi.com.br/getMessages',
      });

      // ===== FALLBACK 5: Instance header instead of body =====
      candidates.push({
        url: `${baseUrl}/getMessages`,
        method: 'POST',
        headers: {
          'apikey': apiToken,
          'instanceId': instanceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, count: 20 }),
        note: 'POST /getMessages (instanceId header)',
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
