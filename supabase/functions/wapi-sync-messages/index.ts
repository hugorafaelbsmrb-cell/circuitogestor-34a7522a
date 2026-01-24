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
    // STEP 1: Get all guardians first (to use their phones as reference)
    // ========================================
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, phone, name')
      .limit(1000);

    const guardianPhoneMap = new Map<string, { id: string; name: string }>();
    const guardiansPhoneList: string[] = [];
    
    (guardians || []).forEach(g => {
      const clean = (g.phone || '').replace(/\D/g, '');
      if (clean && clean.length >= 10) {
        const normalized = clean.startsWith('55') ? clean : `55${clean}`;
        guardianPhoneMap.set(normalized, { id: g.id, name: g.name });
        guardianPhoneMap.set(clean.replace(/^55/, ''), { id: g.id, name: g.name });
        guardiansPhoneList.push(normalized);
      }
    });

    console.log(`Found ${guardiansPhoneList.length} guardian phone numbers to check`);

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
    // STEP 3: Extract all phone numbers from W-API chats
    // ========================================
    const allWapiPhones: string[] = [];
    for (const chat of allWapiChats) {
      let phone = chat.phoneNumber || chat.jid || chat.id || '';
      phone = phone.replace(/@.*$/, '').replace(/\D/g, '');
      if (phone && phone.length >= 10) {
        const normalized = phone.startsWith('55') ? phone : `55${phone}`;
        if (!allWapiPhones.includes(normalized)) {
          allWapiPhones.push(normalized);
        }
      }
    }

    console.log(`Total phones from W-API chats: ${allWapiPhones.length}`);

    // ========================================
    // STEP 4: Prioritize guardian phones, then include ALL others
    // ========================================
    // First: Process guardian phones (those registered in the system)
    // Second: Process ALL other phones from W-API (unknown contacts)
    
    const phonesToProcess: Array<{ phone: string; guardianId: string | null; guardianName: string | null }> = [];

    // Add all guardian phones first
    for (const gPhone of guardiansPhoneList) {
      const guardianInfo = guardianPhoneMap.get(gPhone);
      phonesToProcess.push({
        phone: gPhone,
        guardianId: guardianInfo?.id || null,
        guardianName: guardianInfo?.name || null,
      });
    }

    // Add all W-API phones that are NOT guardians (unknown contacts)
    for (const wapiPhone of allWapiPhones) {
      const isGuardian = guardianPhoneMap.has(wapiPhone) || 
                         guardianPhoneMap.has(wapiPhone.replace(/^55/, ''));
      if (!isGuardian) {
        phonesToProcess.push({
          phone: wapiPhone,
          guardianId: null,
          guardianName: null,
        });
      }
    }

    console.log(`Total phones to process: ${phonesToProcess.length} (${guardiansPhoneList.length} guardians + ${phonesToProcess.length - guardiansPhoneList.length} unknown)`);

    // ========================================
    // STEP 5: Fetch messages for each phone
    // ========================================
    // Helper function to fetch messages with multiple endpoint attempts
    const fetchMessagesForPhone = async (phone: string): Promise<WapiMessage[]> => {
      const remoteJid = `${phone}@s.whatsapp.net`;
      const encodedJid = encodeURIComponent(remoteJid);
      
      const messageEndpoints = [
        `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=50`,
        `${wapiUrl}/v1/chats/fetch-messages?instanceId=${encoded}&phoneNumber=${phone}&limit=50`,
        `${wapiUrl}/v1/chats/messages?instanceId=${encoded}&remoteJid=${encodedJid}&limit=50`,
        `${wapiUrl}/v1/chats/messages?instanceId=${encoded}&phoneNumber=${phone}&limit=50`,
        `${wapiUrl}/v1/message/list?instanceId=${encoded}&remoteJid=${encodedJid}&limit=50`,
      ];

      for (const endpoint of messageEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.W_API_TOKEN}`,
              'Accept': 'application/json',
              'instanceId': session,
            },
          });
          
          if (res.ok) {
            const text = await res.text();
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) return parsed;
              if (parsed.messages && Array.isArray(parsed.messages)) return parsed.messages;
              if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }
      return [];
    };

    // Process each phone
    for (const { phone, guardianId } of phonesToProcess) {
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);

      try {
        console.log(`Processing phone: ${phone.slice(-4)} (guardian: ${guardianId ? 'yes' : 'no'})`);
        
        const messages = await fetchMessagesForPhone(phone);
        
        if (messages.length === 0) {
          // Not an error - just no messages found for this contact
          continue;
        }

        console.log(`Found ${messages.length} messages for ${phone.slice(-4)}`);

        // Process each message
        for (const msg of messages) {
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

          // Insert the message
          const { error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert({
              guardian_id: guardianId, // null for unknown contacts
              phone: phone.startsWith('55') ? phone : `55${phone}`,
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
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (chatError) {
        console.error('Error processing phone:', chatError);
        errorCount++;
      }
    }

    // ========================================
    // STEP 6: Return results
    // ========================================
    const guardiansProcessed = phonesToProcess.filter(p => p.guardianId).length;
    const unknownProcessed = phonesToProcess.filter(p => !p.guardianId).length;

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
