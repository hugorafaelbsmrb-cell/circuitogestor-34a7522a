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
  fromMe?: boolean;
  timestamp?: number;
  t?: number;
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

    // Normalize base URL
    let wapiUrl = config.W_API_URL.replace(/\/$/, '');
    wapiUrl = wapiUrl.replace(/^http:\/\//i, 'https://');
    wapiUrl = wapiUrl.replace(/\/api$/i, '');
    if (/\/\/(app\.)?wawp\.net\b/i.test(wapiUrl)) {
      wapiUrl = 'https://api.w-api.app';
    }

    const session = config.W_API_SESSION;
    const encoded = encodeURIComponent(session);

    let syncedCount = 0;
    let errorCount = 0;
    let detectedPlan: 'PRO' | 'LITE' | 'UNKNOWN' = 'PRO'; // Assume PRO since we have credentials
    const processedPhones = new Set<string>();

    // ========================================
    // DIAGNOSTIC: Test with a known working phone first
    // ========================================
    const testPhone = '5594999345048';
    console.log(`Testing W-API with known phone: ${testPhone}`);
    const testUrl = `${wapiUrl}/v1/chats/chat?instanceId=${encoded}&phoneNumber=${testPhone}`;
    console.log(`Test URL: ${testUrl}`);
    
    try {
      const testRes = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.W_API_TOKEN}`,
          'Accept': 'application/json',
          'instanceId': session,
        },
      });
      const testText = await testRes.text();
      console.log(`Test response status: ${testRes.status}`);
      console.log(`Test response body: ${testText.slice(0, 500)}`);
    } catch (e) {
      console.log(`Test error: ${e}`);
    }

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
          plan: detectedPlan,
          message: 'Nenhum responsável cadastrado para sincronizar',
          synced: 0,
          errors: 0,
          chatsProcessed: 0,
          guardiansProcessed: 0,
          unknownContactsProcessed: 0,
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
    // STEP 2: Function to fetch messages for a phone number
    // ========================================
    // Helper: fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000): Promise<Response | null> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch {
        clearTimeout(id);
        return null;
      }
    };

    type Attempt = { endpoint: string; status: number | null; ok: boolean; note?: string };

    const fetchMessagesForPhone = async (
      phone: string,
    ): Promise<{ messages: WapiMessage[]; success: boolean; workingEndpoint?: string; attempts: Attempt[] }> => {
      const phoneWithCC = phone.startsWith('55') ? phone : `55${phone}`;
      const phoneWithoutCC = phoneWithCC.replace(/^55/, '');

      const attempts: Attempt[] = [];

      // ========================================
      // PRIORITY 1: /v1/chats/chat?phoneNumber= (confirmed working endpoint)
      // This endpoint uses phoneNumber directly without @c.us suffix
      // ========================================
      const priorityEndpoints = [
        `${wapiUrl}/v1/chats/chat?instanceId=${encoded}&phoneNumber=${phoneWithCC}`,
        `${wapiUrl}/v1/chats/chat?instanceId=${encoded}&phoneNumber=${phoneWithoutCC}`,
      ];

      for (const endpoint of priorityEndpoints) {
        const endpointBase = endpoint.split('?')[0];
        
        // Log full URL for first few attempts to debug
        if (attempts.length < 2) {
          console.log(`Trying endpoint: ${endpoint}`);
        }
        
        const res = await fetchWithTimeout(
          endpoint,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.W_API_TOKEN}`,
              'Accept': 'application/json',
              'instanceId': session,
            },
          },
          6000,
        );

        if (!res) {
          attempts.push({ endpoint: endpointBase, status: null, ok: false, note: 'timeout' });
          continue;
        }

        // Log response body for non-OK responses to understand error
        if (!res.ok && attempts.length < 2) {
          try {
            const errText = await res.clone().text();
            console.log(`Response ${res.status} for ${endpoint}: ${errText.slice(0, 200)}`);
          } catch { /* ignore */ }
        }

        attempts.push({ endpoint: endpointBase, status: res.status, ok: res.ok });
        if (!res.ok) continue;

        try {
          const text = await res.text();
          const parsed = JSON.parse(text);
          
          // Log response structure for debugging
          if (attempts.length < 3) {
            console.log(`Response structure keys: ${Object.keys(parsed).join(', ')}`);
          }
          
          // Extract messages from various possible response structures
          const msgs: WapiMessage[] = Array.isArray(parsed)
            ? parsed
            : (parsed.messages ?? parsed.data?.messages ?? parsed.data ?? parsed.chat?.messages ?? []);

          if (Array.isArray(msgs) && msgs.length > 0) {
            console.log(`Found ${msgs.length} messages via /v1/chats/chat for phone ...${phone.slice(-4)}`);
            return { messages: msgs.slice(0, 30), success: true, workingEndpoint: endpointBase, attempts };
          }
        } catch (e) {
          attempts.push({ endpoint: endpointBase, status: res.status, ok: false, note: 'parse_error' });
          continue;
        }
      }

      // ========================================
      // FALLBACK: Try JID-based endpoints if priority endpoints don't work
      // ========================================
      const jidCandidates = [
        `${phoneWithCC}@c.us`,
        `${phoneWithCC}@s.whatsapp.net`,
      ];

      for (const jid of jidCandidates) {
        const encodedJid = encodeURIComponent(jid);

        const fallbackEndpoints = [
          `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=30`,
          `${wapiUrl}/v1/chats/messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=30`,
        ];

        for (const endpoint of fallbackEndpoints) {
          const endpointBase = endpoint.split('?')[0];
          const res = await fetchWithTimeout(
            endpoint,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${config.W_API_TOKEN}`,
                'Accept': 'application/json',
                'instanceId': session,
              },
            },
            4000,
          );

          if (!res) {
            attempts.push({ endpoint: endpointBase, status: null, ok: false, note: 'timeout' });
            continue;
          }

          attempts.push({ endpoint: endpointBase, status: res.status, ok: res.ok });
          if (!res.ok) continue;

          try {
            const text = await res.text();
            const parsed = JSON.parse(text);
            const msgs: WapiMessage[] = Array.isArray(parsed)
              ? parsed
              : (parsed.messages ?? parsed.data ?? []);

            if (Array.isArray(msgs) && msgs.length > 0) {
              return { messages: msgs.slice(0, 30), success: true, workingEndpoint: endpointBase, attempts };
            }
          } catch {
            continue;
          }
        }
      }

      return { messages: [], success: false, attempts };
    };

    // Process a single guardian
    const debugAttempts: Array<{ phoneSuffix: string; attempts: Attempt[] }> = [];

    const processGuardian = async (guardian: { id: string; phone: string; name: string | null }) => {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) return { synced: 0, errors: 0, hasMessages: false };
      
      if (processedPhones.has(phone)) return { synced: 0, errors: 0, hasMessages: false };
      processedPhones.add(phone);

      const { messages, success, attempts } = await fetchMessagesForPhone(phone);

      if (debugAttempts.length < 3) {
        debugAttempts.push({ phoneSuffix: phone.slice(-4), attempts: attempts.slice(0, 10) });
      }
      
      if (!success || messages.length === 0) {
        return { synced: 0, errors: 0, hasMessages: false };
      }

      let localSynced = 0;
      let localErrors = 0;

      // Process messages (limit to 20 most recent to be fast)
      const recentMessages = messages.slice(0, 20);
      
      for (const msg of recentMessages) {
        const messageId = typeof msg.id === 'object' ? msg.id?._serialized : msg.id || msg.key?.id || null;
        const messageText = msg.body || msg.text || msg.message || '';
        const isFromMe = msg.fromMe || msg.key?.fromMe || false;
        const timestamp = msg.timestamp || msg.t || null;

        if (!messageText) continue;

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
            message: messageText,
            direction: isFromMe ? 'outgoing' : 'incoming',
            status: isFromMe ? 'sent' : 'received',
            wapi_message_id: messageId,
            created_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          });

        if (insertError) {
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
    const BATCH_SIZE = 5; // Process 5 guardians in parallel

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

    if (syncedCount === 0) {
      try {
        console.log('Debug samples (first phones):', JSON.stringify(debugAttempts));
      } catch {
        // ignore
      }
    }

    // Derive a more precise message when nothing is returned
    const attemptStatuses = debugAttempts.flatMap((d) => d.attempts.map((a) => a.status).filter((s): s is number => typeof s === 'number'));
    const hasAuthError = attemptStatuses.some((s) => s === 401 || s === 403);
    const allNotFound = attemptStatuses.length > 0 && attemptStatuses.every((s) => s === 404);
    const derivedMessage = hasAuthError
      ? 'A API recusou acesso ao histórico (401/403). Verifique token/permissões da sua instância.'
      : allNotFound
        ? 'Sua instância parece não suportar histórico por API (404). Nesse caso, só mensagens novas (via webhook) serão registradas.'
        : 'Não consegui obter histórico das conversas via API. Vou precisar dos status retornados (debug) para ajustar o endpoint correto.';

    return new Response(
      JSON.stringify({
        // Treat 0 synced as unsuccessful so the frontend can show the derivedMessage branch.
        success: syncedCount > 0,
        plan: detectedPlan,
        message: syncedCount > 0 
          ? `Sincronização concluída: ${syncedCount} mensagens de ${guardiansWithMessages} responsáveis` 
          : derivedMessage,
        synced: syncedCount,
        errors: errorCount,
        chatsProcessed: processedPhones.size,
        guardiansProcessed: guardiansWithMessages,
        unknownContactsProcessed: 0,
        workingEndpoint: null,
        debug: syncedCount === 0 ? { samples: debugAttempts } : null,
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
