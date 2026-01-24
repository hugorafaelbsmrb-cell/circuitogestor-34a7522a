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

    // Normalize base URL
    let wapiUrl = config.W_API_URL.replace(/\/$/, '');
    wapiUrl = wapiUrl.replace(/^http:\/\//i, 'https://');
    wapiUrl = wapiUrl.replace(/\/api$/i, '');
    if (/\/\/(app\.)?wawp\.net\b/i.test(wapiUrl)) {
      wapiUrl = 'https://api.w-api.app';
    }

    const session = config.W_API_SESSION;
    const encoded = encodeURIComponent(session);

    // Em algumas contas/plans a W-API não expõe o endpoint de listar chats.
    // Para evitar dependência disso, sincronizamos mensagens diretamente para os telefones
    // dos responsáveis cadastrados.

    const { data: guardians, error: guardiansError } = await supabase
      .from('guardians')
      .select('id, phone')
      .limit(50);

    if (guardiansError) {
      console.error('Error fetching guardians:', guardiansError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar responsáveis para sincronização' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedGuardians = (guardians || [])
      .map((g) => {
        const clean = (g.phone || '').replace(/\D/g, '');
        if (!clean) return null;
        const phone = clean.startsWith('55') ? clean : `55${clean}`;
        return { guardianId: g.id, phone };
      })
      .filter(Boolean) as Array<{ guardianId: string; phone: string }>;

    let syncedCount = 0;
    let errorCount = 0;
    const processedPhones = new Set<string>();
    const debugFailures: Array<{
      phone_mask: string;
      attempts: Array<{ url: string; status: number | null; note?: string; snippet?: string }>;
    }> = [];

    const getMessageEndpoints = (phone: string, limit = 20) => [
      // Prefer /v1/chat/messages
      `${wapiUrl}/v1/chat/messages?instanceId=${encoded}&phone=${phone}&limit=${limit}`,
      // Some variants
      `${wapiUrl}/chat/messages?instanceId=${encoded}&phone=${phone}&limit=${limit}`,
      `${wapiUrl}/v1/messages?instanceId=${encoded}&phone=${phone}&limit=${limit}`,
      // Some APIs use chatId
      `${wapiUrl}/v1/chat/messages?instanceId=${encoded}&chatId=${phone}@c.us&limit=${limit}`,
    ];

    for (const g of normalizedGuardians) {
      try {
        const phone = g.phone;
        if (processedPhones.has(phone)) continue;
        processedPhones.add(phone);

        // Fetch messages for this phone - try multiple endpoints
        let messagesData: any = null;
        const messageEndpoints = getMessageEndpoints(phone, 20);
        const attempts: Array<{ url: string; status: number | null; note?: string; snippet?: string }> = [];

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

            const text = await res.text();

            // Guardar diagnóstico (sem expor telefone completo)
            if (debugFailures.length < 5) {
              const sanitizedUrl = endpoint
                .replace(/phone=\d+/g, 'phone=<redacted>')
                .replace(/chatId=\d+@c\.us/g, 'chatId=<redacted>@c.us');
              attempts.push({
                url: sanitizedUrl,
                status: res.status,
                snippet: text?.slice(0, 160),
              });
            }

            if (!res.ok) continue;

            try {
              messagesData = JSON.parse(text);
              break;
            } catch {
              if (debugFailures.length < 5) {
                attempts[attempts.length - 1].note = 'Non-JSON';
              }
              continue;
            }
          } catch {
            if (debugFailures.length < 5) {
              attempts.push({ url: endpoint, status: null, note: 'Fetch failed' });
            }
            continue;
          }
        }

        if (!messagesData) {
          if (debugFailures.length < 5) {
            debugFailures.push({
              phone_mask: phone.slice(-4).padStart(phone.length, '*'),
              attempts,
            });
          }
          errorCount++;
          continue;
        }

        const messages = Array.isArray(messagesData) ? messagesData : (messagesData.messages || messagesData.data || []);

        // Match to guardian
        const guardianId = g.guardianId || null;

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
        await new Promise(resolve => setTimeout(resolve, 120));

      } catch (chatError) {
        console.error('Error processing chat:', chatError);
        errorCount++;
      }
    }

    console.log(`Sync complete: ${syncedCount} messages synced, ${errorCount} errors`);

    const allFailed = processedPhones.size > 0 && syncedCount === 0 && errorCount >= processedPhones.size;

    return new Response(
      JSON.stringify({
        success: !allFailed,
        message: allFailed
          ? 'Sincronização indisponível: a W-API retornou 404 para endpoints de histórico (chats/mensagens).'
          : 'Sincronização concluída',
        hint: allFailed
          ? 'Neste cenário, o sistema depende dos webhooks (mensagens recebidas) e do histórico passa a ser coletado apenas a partir de agora.'
          : undefined,
        synced: syncedCount,
        errors: errorCount,
        chatsProcessed: processedPhones.size,
        debug: debugFailures.length ? debugFailures : undefined,
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
