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

    const fetchMessagesForPhone = async (
      phone: string,
    ): Promise<{ messages: WapiMessage[]; success: boolean; workingEndpoint?: string }> => {
      const phoneWithCC = phone.startsWith('55') ? phone : `55${phone}`;
      
      const jidCandidates = [
        `${phoneWithCC}@c.us`,
        `${phoneWithCC}@s.whatsapp.net`,
      ];

      // Try only the first 2 most common endpoints to be faster
      for (const jid of jidCandidates) {
        const encodedJid = encodeURIComponent(jid);
        
        const endpoints = [
          `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=30`,
          `${wapiUrl}/v1/message/list?instanceId=${encoded}&remoteJid=${encodedJid}&limit=30`,
        ];

        for (const endpoint of endpoints) {
          const res = await fetchWithTimeout(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.W_API_TOKEN}`,
              'Accept': 'application/json',
              'instanceId': session,
            },
          }, 4000);

          if (!res || !res.ok) continue;

          try {
            const text = await res.text();
            const parsed = JSON.parse(text);
            const msgs: WapiMessage[] = Array.isArray(parsed)
              ? parsed
              : (Array.isArray(parsed.messages) ? parsed.messages : (Array.isArray(parsed.data) ? parsed.data : []));
            
            if (msgs.length > 0) {
              return { messages: msgs, success: true, workingEndpoint: endpoint.split('?')[0] };
            }
          } catch {
            continue;
          }
        }
      }

      return { messages: [], success: false };
    };

    // Process a single guardian
    const processGuardian = async (guardian: { id: string; phone: string; name: string | null }) => {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) return { synced: 0, errors: 0, hasMessages: false };
      
      if (processedPhones.has(phone)) return { synced: 0, errors: 0, hasMessages: false };
      processedPhones.add(phone);

      const { messages, success } = await fetchMessagesForPhone(phone);
      
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

    return new Response(
      JSON.stringify({
        success: syncedCount > 0 || errorCount === 0,
        plan: detectedPlan,
        message: syncedCount > 0 
          ? `Sincronização concluída: ${syncedCount} mensagens de ${guardiansWithMessages} responsáveis` 
          : guardiansWithMessages === 0 
            ? 'Nenhuma conversa encontrada com os responsáveis cadastrados'
            : 'Nenhuma mensagem nova encontrada',
        synced: syncedCount,
        errors: errorCount,
        chatsProcessed: processedPhones.size,
        guardiansProcessed: guardiansWithMessages,
        unknownContactsProcessed: 0,
        workingEndpoint: null,
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
