import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WapiChat {
  id?: string;
  jid?: string;
  phoneNumber?: string;
  name?: string;
  lastMessage?: {
    body?: string;
    timestamp?: number;
  };
}

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config from app_settings
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
    let detectedPlan: 'PRO' | 'LITE' | 'UNKNOWN' = 'UNKNOWN';
    const processedPhones = new Set<string>();

    // ========================================
    // STEP 1: Load guardians (phone -> guardian) for matching
    // ========================================
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, phone, name')
      .limit(1000);

    const guardianPhoneMap = new Map<string, { id: string; name: string }>();
    
    (guardians || []).forEach(g => {
      const clean = (g.phone || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) {
        const normalized = clean.startsWith('55') ? clean : `55${clean}`;
        guardianPhoneMap.set(normalized, { id: g.id, name: g.name });
        // Also map without country code for flexibility
        guardianPhoneMap.set(normalized.replace(/^55/, ''), { id: g.id, name: g.name });
      }
    });

    const normalizeToBR = (raw: string) => {
      const digits = (raw || '').replace(/\D/g, '');
      if (!digits) return '';
      return digits.startsWith('55') ? digits : `55${digits}`;
    };

    // ========================================
    // STEP 2: Detect plan by trying PRO endpoint
    // ========================================
    const fetchChatsUrl = `${wapiUrl}/v1/chats/fetch-chats?instanceId=${encoded}&perPage=100&page=1`;
    console.log('Trying PRO endpoint to detect plan:', fetchChatsUrl);

    let allWapiChats: WapiChat[] = [];
    
    try {
      const chatsRes = await fetch(fetchChatsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.W_API_TOKEN}`,
          'Accept': 'application/json',
          'instanceId': session,
        },
      });

      console.log('PRO fetch-chats response status:', chatsRes.status);

      if (chatsRes.ok) {
        detectedPlan = 'PRO';
        const responseText = await chatsRes.text();
        
        try {
          const parsed = JSON.parse(responseText);
          if (Array.isArray(parsed)) {
            allWapiChats = parsed;
          } else if (parsed.chats && Array.isArray(parsed.chats)) {
            allWapiChats = parsed.chats;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            allWapiChats = parsed.data;
          }
          console.log(`PRO: Found ${allWapiChats.length} chats in W-API`);
        } catch (parseErr) {
          console.error('Error parsing chats response:', parseErr);
        }
      } else if (chatsRes.status === 404 || chatsRes.status === 403) {
        detectedPlan = 'LITE';
        console.log('PRO endpoint returned 404/403 - detected LITE plan');
      } else {
        console.log('PRO endpoint returned unexpected status:', chatsRes.status);
      }
    } catch (fetchErr) {
      console.error('Error fetching chats:', fetchErr);
    }

    // ========================================
    // STEP 2B: If LITE, return informative response
    // ========================================
    if (detectedPlan === 'LITE') {
      return new Response(
        JSON.stringify({
          success: false,
          plan: 'LITE',
          message: 'Plano LITE detectado - histórico de mensagens não disponível',
          hint: 'O plano LITE da W-API não oferece endpoints de histórico. ' +
                'As mensagens são capturadas automaticamente via webhook quando recebidas. ' +
                'Para sincronização de histórico, é necessário upgrade para o plano PRO.',
          synced: 0,
          errors: 0,
          chatsProcessed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ========================================
    // STEP 3: Process chats from W-API using their real jid/id
    // ========================================
    const guardiansProcessedSet = new Set<string>();
    const unknownContactsProcessedSet = new Set<string>();

    const extractPhoneFromChat = (chat: WapiChat) => {
      const raw = (chat.phoneNumber || chat.jid || chat.id || '').toString();
      const digits = raw.replace(/@.*$/, '').replace(/\D/g, '');
      return digits;
    };

    const fetchMessagesForChat = async (
      jidCandidates: string[],
    ): Promise<{ messages: WapiMessage[]; attempts: Array<{ endpoint: string; status: number | null }> }> => {
      const attempts: Array<{ endpoint: string; status: number | null }> = [];

      for (const jid of jidCandidates) {
        const encodedJid = encodeURIComponent(jid);
        const endpoints = [
          // Most common: fetch-messages with remoteJid
          `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=50`,
          // Some gateways use chatId instead of remoteJid
          `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&chatId=${encodedJid}&limit=50`,
          // Fallback variant
          `${wapiUrl}/v1/chats/messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=50`,
        ];

        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${config.W_API_TOKEN}`,
                'Accept': 'application/json',
                'instanceId': session,
              },
            });

            attempts.push({ endpoint: endpoint.replace(encodedJid, '<jid>'), status: res.status });

            if (!res.ok) continue;

            const text = await res.text();
            try {
              const parsed = JSON.parse(text);
              const msgs = Array.isArray(parsed)
                ? parsed
                : (Array.isArray(parsed.messages) ? parsed.messages : (Array.isArray(parsed.data) ? parsed.data : []));
              return { messages: msgs, attempts };
            } catch {
              // invalid json -> try next
              continue;
            }
          } catch (e) {
            attempts.push({ endpoint: endpoint.replace(encodedJid, '<jid>'), status: null });
            continue;
          }
        }
      }

      return { messages: [], attempts };
    };

    for (const chat of allWapiChats) {
      const rawJid = (chat.jid || chat.id || '').toString();
      const extractedDigits = extractPhoneFromChat(chat);
      if (!extractedDigits || extractedDigits.length < 10) continue;

      const phone = normalizeToBR(extractedDigits);
      if (!phone) continue;
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);

      const guardianInfo = guardianPhoneMap.get(phone) || guardianPhoneMap.get(phone.replace(/^55/, ''));
      const guardianId = guardianInfo?.id || null;

      if (guardianId) guardiansProcessedSet.add(guardianId);
      else unknownContactsProcessedSet.add(phone);

      // Build JID candidates: prefer the jid from W-API; otherwise try a small set of common suffixes.
      const jidCandidates: string[] = [];
      if (rawJid && rawJid.includes('@')) {
        jidCandidates.push(rawJid);
      } else {
        jidCandidates.push(`${phone}@c.us`);
        jidCandidates.push(`${phone.replace(/^55/, '')}@c.us`);
        jidCandidates.push(`${phone}@s.whatsapp.net`);
      }

      console.log(`Processing chat for phone: ${phone.slice(-4)} (guardian: ${guardianId ? 'yes' : 'no'})`);

      const { messages, attempts } = await fetchMessagesForChat(jidCandidates);

      if (!messages || messages.length === 0) {
        // If the provider returns 404/403 for all attempts, count as an error (helps debugging)
        const anyStatus = attempts.some(a => a.status !== null);
        const allNotOk = anyStatus && attempts.every(a => a.status !== 200);
        if (allNotOk) {
          errorCount++;
          console.log(`No history for ${phone.slice(-4)}. Last attempts:`, attempts.slice(-2));
        }
        continue;
      }

      console.log(`Found ${messages.length} messages for ${phone.slice(-4)}`);

      for (const msg of messages) {
        const messageId = typeof msg.id === 'object' ? msg.id?._serialized : msg.id || msg.key?.id || null;
        const messageText = msg.body || msg.text || msg.message || '';
        const isFromMe = msg.fromMe || msg.key?.fromMe || false;
        const timestamp = msg.timestamp || msg.t || null;

        if (!messageText) continue;

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
            guardian_id: guardianId,
            phone,
            message: messageText,
            direction: isFromMe ? 'outgoing' : 'incoming',
            status: isFromMe ? 'sent' : 'received',
            wapi_message_id: messageId,
            created_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error inserting message:', insertError);
          errorCount++;
        } else {
          syncedCount++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    // ========================================
    // STEP 4: Return results
    // ========================================
    const guardiansProcessed = guardiansProcessedSet.size;
    const unknownProcessed = unknownContactsProcessedSet.size;

    console.log(`Sync complete: ${syncedCount} messages synced, ${errorCount} errors, plan: ${detectedPlan}`);
    console.log(`Processed: ${guardiansProcessed} guardians, ${unknownProcessed} unknown contacts`);

    return new Response(
      JSON.stringify({
        success: syncedCount > 0 || errorCount === 0,
        plan: detectedPlan,
        message: syncedCount > 0 
          ? 'Sincronização concluída com sucesso' 
          : 'Nenhuma mensagem nova encontrada',
        synced: syncedCount,
        errors: errorCount,
        chatsProcessed: processedPhones.size,
        guardiansProcessed,
        unknownContactsProcessed: unknownProcessed,
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
