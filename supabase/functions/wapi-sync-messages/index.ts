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
    // STEP 1: Try PRO endpoint to list all chats
    // ========================================
    const fetchChatsUrl = `${wapiUrl}/v1/chats/fetch-chats?instanceId=${encoded}&perPage=50&page=1`;
    console.log('Trying PRO endpoint:', fetchChatsUrl);

    let chatsData: WapiChat[] = [];
    
    try {
      const chatsRes = await fetch(fetchChatsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.W_API_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      console.log('PRO fetch-chats response status:', chatsRes.status);

      if (chatsRes.ok) {
        detectedPlan = 'PRO';
        const responseText = await chatsRes.text();
        
        try {
          const parsed = JSON.parse(responseText);
          // Response can be array directly or { chats: [...] } or { data: [...] }
          if (Array.isArray(parsed)) {
            chatsData = parsed;
          } else if (parsed.chats && Array.isArray(parsed.chats)) {
            chatsData = parsed.chats;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            chatsData = parsed.data;
          }
          console.log(`PRO: Found ${chatsData.length} chats`);
        } catch (parseErr) {
          console.error('Error parsing chats response:', parseErr);
        }
      } else if (chatsRes.status === 404 || chatsRes.status === 403) {
        // PRO endpoint not available - this is LITE plan
        detectedPlan = 'LITE';
        console.log('PRO endpoint returned 404/403 - detected LITE plan');
      } else {
        console.log('PRO endpoint returned unexpected status:', chatsRes.status);
      }
    } catch (fetchErr) {
      console.error('Error fetching chats:', fetchErr);
    }

    // ========================================
    // STEP 2A: If PRO, iterate chats and fetch messages
    // ========================================
    if (detectedPlan === 'PRO' && chatsData.length > 0) {
      // Get guardians for matching
      const { data: guardians } = await supabase
        .from('guardians')
        .select('id, phone')
        .limit(500);

      const guardianPhoneMap = new Map<string, string>();
      (guardians || []).forEach(g => {
        const clean = (g.phone || '').replace(/\D/g, '');
        if (clean) {
          const normalized = clean.startsWith('55') ? clean : `55${clean}`;
          guardianPhoneMap.set(normalized, g.id);
          // Also map without country code for flexibility
          guardianPhoneMap.set(clean.replace(/^55/, ''), g.id);
        }
      });

      for (const chat of chatsData) {
        try {
          // Extract phone number from chat
          let phone = chat.phoneNumber || chat.jid || chat.id || '';
          // Clean phone: remove @c.us, @s.whatsapp.net, etc
          phone = phone.replace(/@.*$/, '').replace(/\D/g, '');
          
          if (!phone || phone.length < 10) continue;
          if (processedPhones.has(phone)) continue;
          processedPhones.add(phone);

          // Fetch messages for this specific chat using PRO endpoint
          const chatUrl = `${wapiUrl}/v1/chats/chat?instanceId=${encoded}&phoneNumber=${phone}`;
          console.log('Fetching chat details:', chatUrl.replace(phone, '<phone>'));

          const chatRes = await fetch(chatUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.W_API_TOKEN}`,
              'Accept': 'application/json',
            },
          });

          if (!chatRes.ok) {
            console.log(`Chat fetch failed for phone: status ${chatRes.status}`);
            errorCount++;
            continue;
          }

          const chatText = await chatRes.text();
          let messages: WapiMessage[] = [];
          
          try {
            const chatParsed = JSON.parse(chatText);
            // Messages can be in .messages, .data, or directly as array
            if (Array.isArray(chatParsed)) {
              messages = chatParsed;
            } else if (chatParsed.messages && Array.isArray(chatParsed.messages)) {
              messages = chatParsed.messages;
            } else if (chatParsed.data && Array.isArray(chatParsed.data)) {
              messages = chatParsed.data;
            }
          } catch {
            console.error('Error parsing chat messages');
            continue;
          }

          // Match to guardian
          const guardianId = guardianPhoneMap.get(phone) || 
                            guardianPhoneMap.get(phone.replace(/^55/, '')) || 
                            null;

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
                guardian_id: guardianId,
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
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (chatError) {
          console.error('Error processing chat:', chatError);
          errorCount++;
        }
      }
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
    // STEP 3: Return results
    // ========================================
    console.log(`Sync complete: ${syncedCount} messages synced, ${errorCount} errors, plan: ${detectedPlan}`);

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
