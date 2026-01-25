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
    // SIMPLIFIED W-API PRO CONFIGURATION
    // Based on user documentation:
    // - Base URL: https://api.wapi.com.br (PRO standard)
    // - Endpoint: GET /all-messages?chatId=...&limit=20
    // - Headers: apikey, Content-Type
    // ========================================
    
    // Use api.wapi.com.br as primary (PRO standard)
    // Fall back to configured URL only if different
    const PRO_BASE_URL = 'https://api.wapi.com.br';
    
    // Normalize configured URL
    let configuredUrl = (config.W_API_URL || '').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(configuredUrl)) {
      configuredUrl = `https://${configuredUrl}`;
    }
    
    const apiKey = config.W_API_TOKEN;
    const instanceId = config.W_API_SESSION;

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
    // SIMPLE FETCH FUNCTION (per W-API PRO docs)
    // ========================================
    const fetchWhatsAppHistory = async (chatId: string, baseUrl: string): Promise<WapiMessage[]> => {
      const url = `${baseUrl}/all-messages?chatId=${encodeURIComponent(chatId)}&limit=20`;
      
      console.log(`Fetching: ${url}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.log(`Error ${response.status}: ${errText.slice(0, 200)}`);
          return [];
        }

        const data = await response.json();
        console.log(`Response type: ${typeof data}, isArray: ${Array.isArray(data)}`);
        
        // Extract messages from response
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
        }
        
        console.log(`Found ${messages.length} messages`);
        return messages;
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`Fetch error: ${msg}`);
        return [];
      }
    };

    // Try with /getMessages as fallback (legacy endpoint)
    const fetchWithFallback = async (chatId: string, baseUrl: string): Promise<WapiMessage[]> => {
      // Try primary endpoint first
      let messages = await fetchWhatsAppHistory(chatId, baseUrl);
      
      if (messages.length > 0) return messages;
      
      // Fallback: try /getMessages (with capital M)
      const fallbackUrl = `${baseUrl}/getMessages?chatId=${encodeURIComponent(chatId)}&count=20`;
      console.log(`Trying fallback: ${fallbackUrl}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        
        const response = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) return [];

        const data = await response.json();
        
        if (Array.isArray(data)) return data;
        if (data.messages && Array.isArray(data.messages)) return data.messages;
        if (data.data && Array.isArray(data.data)) return data.data;
        
        return [];
      } catch {
        return [];
      }
    };

    // ========================================
    // PROCESS GUARDIANS
    // ========================================
    const debugInfo: Array<{ phone: string; chatId: string; messagesFound: number; baseUrl: string }> = [];
    let guardiansWithMessages = 0;
    
    // Try PRO URL first, then configured URL
    const baseUrlsToTry = [PRO_BASE_URL];
    if (configuredUrl !== PRO_BASE_URL) {
      baseUrlsToTry.push(configuredUrl);
    }

    for (const guardian of guardians) {
      const phone = normalizeToBR(guardian.phone);
      if (!phone || phone.length < 12) continue;
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);

      const chatId = `${phone}@c.us`;
      
      let messages: WapiMessage[] = [];
      let usedBaseUrl = '';
      
      // Try each base URL until we get messages
      for (const baseUrl of baseUrlsToTry) {
        messages = await fetchWithFallback(chatId, baseUrl);
        if (messages.length > 0) {
          usedBaseUrl = baseUrl;
          break;
        }
      }
      
      // Store debug info for first 5 phones
      if (debugInfo.length < 5) {
        debugInfo.push({
          phone: phone.slice(-4),
          chatId,
          messagesFound: messages.length,
          baseUrl: usedBaseUrl || baseUrlsToTry[0],
        });
      }

      if (messages.length === 0) continue;
      
      guardiansWithMessages++;

      // Insert messages
      for (const msg of messages.slice(0, 20)) {
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
      message = 'Nenhuma mensagem encontrada. Verifique se a instância está conectada e se há histórico de conversa com os contatos.';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        synced: syncedCount,
        errors: errorCount,
        guardiansProcessed: processedPhones.size,
        guardiansWithMessages,
        debug: syncedCount === 0 ? {
          proBaseUrl: PRO_BASE_URL,
          configuredUrl,
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
