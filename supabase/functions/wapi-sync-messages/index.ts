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

    // Normalize base URL (keep the configured provider host; do NOT force a specific domain)
    let wapiUrl = (config.W_API_URL || '').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(wapiUrl)) {
      wapiUrl = `https://${wapiUrl}`;
    }
    wapiUrl = wapiUrl.replace(/^http:\/\//i, 'https://');

    const session = config.W_API_SESSION;
    const apiToken = config.W_API_TOKEN;

    let syncedCount = 0;
    let errorCount = 0;
    const processedPhones = new Set<string>();

    // ========================================
    // STEP 1: Load ALL guardians with their phones
    // ========================================
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
          guardiansProcessed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Found ${guardians.length} guardians to check for messages`);

    // Helper to normalize phone to BR format
    const normalizeToBR = (raw: string) => {
      const digits = (raw || '').replace(/\D/g, '');
      if (!digits) return '';
      return digits.startsWith('55') ? digits : `55${digits}`;
    };

    // ========================================
    // STEP 2: Function to fetch messages using correct W-API PRO format
    // Based on documentation:
    // - Main domain: https://api.wapi.com.br
    // - Alternative (V3/PRO): https://v3.wapi.com.br
    // - Format: GET /getMessages?chatId=5511999999999@c.us&count=50
    // - Some versions need /{instanceId}/getMessages
    // Headers: apikey, Content-Type
    // ========================================
    type Attempt = { endpoint: string; status: number | null; ok: boolean; note?: string };

    // Determine correct base URL
    // Try to extract the correct provider domain, prioritize api.wapi.com.br
    const getBaseUrls = (): string[] => {
      const configuredUrl = wapiUrl.toLowerCase();
      
      // If user configured a specific URL that's NOT the generic w-api.app, use it
      if (!configuredUrl.includes('w-api.app') && !configuredUrl.includes('wapi.app')) {
        return [wapiUrl];
      }
      
      // Use the correct W-API PRO domains
      return [
        'https://api.wapi.com.br',
        'https://v3.wapi.com.br',
      ];
    };

    const baseUrls = getBaseUrls();
    console.log(`Using base URLs: ${baseUrls.join(', ')}`);

    const fetchMessagesForPhone = async (
      phone: string,
    ): Promise<{ messages: WapiMessage[]; success: boolean; workingEndpoint?: string; attempts: Attempt[] }> => {
      const phoneWithCC = phone.startsWith('55') ? phone : `55${phone}`;
      const chatId = `${phoneWithCC}@c.us`;
      
      const attempts: Attempt[] = [];

      // Build all candidate URLs following W-API PRO documentation
      const candidates: Array<{ url: string; headers: Record<string, string>; note: string }> = [];

      for (const baseUrl of baseUrls) {
        // Format 1: GET /getMessages?chatId=...&count=... (apikey header)
        candidates.push({
          url: `${baseUrl}/getMessages?chatId=${encodeURIComponent(chatId)}&count=50`,
          headers: { 'apikey': apiToken, 'Content-Type': 'application/json' },
          note: `${baseUrl}/getMessages (apikey header)`,
        });

        // Format 2: GET /{instanceId}/getMessages?chatId=...&count=... (Instance ID in path)
        candidates.push({
          url: `${baseUrl}/${session}/getMessages?chatId=${encodeURIComponent(chatId)}&count=50`,
          headers: { 'apikey': apiToken, 'Content-Type': 'application/json' },
          note: `${baseUrl}/{instanceId}/getMessages`,
        });

        // Format 3: Instance ID as query param
        candidates.push({
          url: `${baseUrl}/getMessages?chatId=${encodeURIComponent(chatId)}&count=50&instanceId=${encodeURIComponent(session)}`,
          headers: { 'apikey': apiToken, 'Content-Type': 'application/json' },
          note: `${baseUrl}/getMessages?instanceId=...`,
        });

        // Format 4: Instance ID in header
        candidates.push({
          url: `${baseUrl}/getMessages?chatId=${encodeURIComponent(chatId)}&count=50`,
          headers: { 'apikey': apiToken, 'instanceId': session, 'Content-Type': 'application/json' },
          note: `${baseUrl}/getMessages (instanceId header)`,
        });

        // Format 5: Authorization Bearer instead of apikey
        candidates.push({
          url: `${baseUrl}/getMessages?chatId=${encodeURIComponent(chatId)}&count=50`,
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
          note: `${baseUrl}/getMessages (Bearer token)`,
        });

        // Format 6: v1 prefix
        candidates.push({
          url: `${baseUrl}/v1/getMessages?chatId=${encodeURIComponent(chatId)}&count=50`,
          headers: { 'apikey': apiToken, 'instanceId': session, 'Content-Type': 'application/json' },
          note: `${baseUrl}/v1/getMessages`,
        });
      }

      console.log(`Trying ${candidates.length} endpoint candidates for chatId: ${chatId}`);
      
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate.url, {
            method: 'GET',
            headers: candidate.headers,
          });

          attempts.push({ endpoint: candidate.note, status: res.status, ok: res.ok });

          if (res.ok) {
            const text = await res.text();
            console.log(`SUCCESS ${candidate.note}: ${text.slice(0, 200)}`);
            
            try {
              const parsed = JSON.parse(text);
              
              // Extract messages from various possible response structures
              const msgs: WapiMessage[] = Array.isArray(parsed)
                ? parsed
                : (parsed.messages ?? parsed.data?.messages ?? parsed.data ?? parsed.result ?? []);

              if (Array.isArray(msgs) && msgs.length > 0) {
                console.log(`Found ${msgs.length} messages using: ${candidate.note}`);
                return { messages: msgs.slice(0, 30), success: true, workingEndpoint: candidate.note, attempts };
              }
            } catch (parseError) {
              console.log(`Parse error for ${candidate.note}: ${parseError}`);
            }
          } else if (res.status !== 404) {
            // Log non-404 errors for debugging
            const errText = await res.text();
            console.log(`Error ${res.status} at ${candidate.note}: ${errText.slice(0, 100)}`);
          }
        } catch (fetchError) {
          attempts.push({ endpoint: candidate.note, status: null, ok: false, note: 'fetch_error' });
        }
      }

      return { messages: [], success: false, attempts };
    };

    // Process a single guardian
    const debugAttempts: Array<{ phoneSuffix: string; chatId: string; attempts: Attempt[] }> = [];

    const processGuardian = async (guardian: { id: string; phone: string; name: string | null }) => {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) return { synced: 0, errors: 0, hasMessages: false };
      
      if (processedPhones.has(phone)) return { synced: 0, errors: 0, hasMessages: false };
      processedPhones.add(phone);

      const { messages, success, attempts } = await fetchMessagesForPhone(phone);

      // Store debug info for first few phones
      if (debugAttempts.length < 5) {
        debugAttempts.push({ 
          phoneSuffix: phone.slice(-4), 
          chatId: `${phone}@c.us`,
          attempts: attempts.slice(0, 10) 
        });
      }
      
      if (!success || messages.length === 0) {
        return { synced: 0, errors: 0, hasMessages: false };
      }

      let localSynced = 0;
      let localErrors = 0;

      // Process messages (limit to 20 most recent)
      const recentMessages = messages.slice(0, 20);
      
      for (const msg of recentMessages) {
        const messageId = typeof msg.id === 'object' ? msg.id?._serialized : msg.id || msg.key?.id || null;
        const messageText = msg.body || msg.text || msg.message || msg.content || '';
        const isFromMe = msg.fromMe || msg.key?.fromMe || false;
        const timestamp = msg.timestamp || msg.t || null;

        if (!messageText && !msg.hasMedia) continue;

        // Check if message already exists
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
          localErrors++;
        } else {
          localSynced++;
        }
      }

      return { synced: localSynced, errors: localErrors, hasMessages: true };
    };

    // ========================================
    // STEP 3: Process guardians in parallel batches
    // ========================================
    let guardiansWithMessages = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < guardians.length; i += BATCH_SIZE) {
      const batch = guardians.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(g => g.name?.split(' ')[0]).join(', ')}`);
      
      const results = await Promise.all(batch.map(g => processGuardian(g)));
      
      for (const result of results) {
        syncedCount += result.synced;
        errorCount += result.errors;
        if (result.hasMessages) guardiansWithMessages++;
      }
    }

    console.log(`Sync complete: ${syncedCount} messages synced, ${errorCount} errors`);
    console.log(`Guardians checked: ${processedPhones.size}, with messages: ${guardiansWithMessages}`);

    // Debug output when nothing synced
    if (syncedCount === 0 && debugAttempts.length > 0) {
      console.log('Debug samples:', JSON.stringify(debugAttempts.slice(0, 3)));
    }

    // Derive message based on attempt results
    const attemptStatuses = debugAttempts.flatMap((d) => d.attempts.map((a) => a.status).filter((s): s is number => typeof s === 'number'));
    const hasAuthError = attemptStatuses.some((s) => s === 401 || s === 403);
    const allNotFound = attemptStatuses.length > 0 && attemptStatuses.every((s) => s === 404);
    
    const derivedMessage = hasAuthError
      ? 'A API recusou acesso (401/403). Verifique se o token (apikey) está correto.'
      : allNotFound
        ? 'Endpoint /getMessages retornou 404. Verifique se sua instância W-API está no plano PRO com histórico habilitado.'
        : syncedCount === 0
          ? 'Nenhuma mensagem encontrada. Pode ser que não haja conversas recentes ou o endpoint não está correto.'
          : `Sincronização concluída: ${syncedCount} mensagens de ${guardiansWithMessages} responsáveis`;

    return new Response(
      JSON.stringify({
        success: syncedCount > 0,
        message: derivedMessage,
        synced: syncedCount,
        errors: errorCount,
        guardiansProcessed: processedPhones.size,
        guardiansWithMessages,
        debug: syncedCount === 0 ? { 
          baseUrl: wapiUrl,
          sampleChatId: debugAttempts[0]?.chatId || null,
          samples: debugAttempts 
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: unknown) {
    console.error('Error in wapi-sync-messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
