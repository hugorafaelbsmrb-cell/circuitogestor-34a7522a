import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
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

    // Fetch recent chats from W-API
    const wapiUrl = config.W_API_URL.replace(/\/$/, '');
    
    // First, get recent chats - using Bearer token authentication
    const chatsResponse = await fetch(`${wapiUrl}/chat/list/${config.W_API_SESSION}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
    });

    if (!chatsResponse.ok) {
      const errorData = await chatsResponse.text();
      console.error('W-API chats error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conversas do W-API', details: errorData }),
        { status: chatsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatsData = await chatsResponse.json();
    console.log('Chats fetched:', chatsData);

    // Get all guardians for phone matching
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, phone');

    const guardianPhoneMap = new Map<string, string>();
    guardians?.forEach(g => {
      const cleanPhone = g.phone.replace(/\D/g, '');
      const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      guardianPhoneMap.set(normalizedPhone, g.id);
    });

    let syncedCount = 0;
    let errorCount = 0;
    const processedPhones = new Set<string>();

    // Process each chat and get messages
    const chats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || chatsData.data || []);
    
    for (const chat of chats.slice(0, 50)) { // Limit to 50 most recent chats
      try {
        // Extract phone from chat id (format: 5511999999999@s.whatsapp.net)
        const chatId = chat.id?._serialized || chat.id || chat.jid || '';
        if (!chatId.includes('@s.whatsapp.net')) continue; // Skip groups
        
        const phone = chatId.replace('@s.whatsapp.net', '');
        if (processedPhones.has(phone)) continue;
        processedPhones.add(phone);

        // Fetch messages for this chat
        const messagesResponse = await fetch(
          `${wapiUrl}/chat/messages/${config.W_API_SESSION}?phone=${phone}&limit=20`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.W_API_TOKEN}`,
            },
          }
        );

        if (!messagesResponse.ok) {
          console.error(`Error fetching messages for ${phone}`);
          errorCount++;
          continue;
        }

        const messagesData = await messagesResponse.json();
        const messages = Array.isArray(messagesData) ? messagesData : (messagesData.messages || messagesData.data || []);

        // Match to guardian
        const guardianId = guardianPhoneMap.get(phone) || null;

        // Process each message
        for (const msg of messages) {
          const messageId = msg.id?._serialized || msg.id || msg.key?.id || null;
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

            if (existing) continue; // Skip if already synced
          }

          // Insert the message
          const { error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert({
              guardian_id: guardianId,
              phone: phone,
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

    console.log(`Sync complete: ${syncedCount} messages synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização concluída`,
        synced: syncedCount,
        errors: errorCount,
        chatsProcessed: processedPhones.size,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
