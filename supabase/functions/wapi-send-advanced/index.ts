import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface ButtonOption {
  id: string;
  text: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface SendAdvancedRequest {
  phone: string;
  messageType: 'buttons' | 'list' | 'link' | 'sticker' | 'location' | 'contact';
  isGroup?: boolean;
  // For buttons
  title?: string;
  message?: string;
  footer?: string;
  buttons?: ButtonOption[];
  // For list
  buttonText?: string;
  sections?: ListSection[];
  // For link
  url?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkPreviewImage?: string;
  // For sticker
  stickerUrl?: string;
  // For location
  latitude?: number;
  longitude?: number;
  locationName?: string;
  address?: string;
  // For contact/vcard
  contactName?: string;
  contactPhone?: string;
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

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get W-API config
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_URL']);

    const config: Record<string, string> = {};
    settings?.forEach(s => {
      if (s.value) config[s.key] = s.value;
    });

    if (!config.W_API_TOKEN || !config.W_API_SESSION) {
      return new Response(
        JSON.stringify({ error: 'W-API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: SendAdvancedRequest = await req.json();
    const { phone, messageType, isGroup = false } = payload;

    if (!phone || !messageType) {
      return new Response(
        JSON.stringify({ error: 'phone e messageType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const instanceId = encodeURIComponent(config.W_API_SESSION);

    let endpoint: string;
    let requestBody: Record<string, unknown>;
    let messageForDb = '';

    switch (messageType) {
      case 'buttons':
        endpoint = `${baseUrl}/v1/message/send-buttons?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          title: payload.title || '',
          message: payload.message || '',
          footer: payload.footer || '',
          buttons: payload.buttons || [],
          isGroup,
        };
        messageForDb = `[Botões] ${payload.message || payload.title || ''}`;
        break;

      case 'list':
        endpoint = `${baseUrl}/v1/message/send-list?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          title: payload.title || '',
          message: payload.message || '',
          footer: payload.footer || '',
          buttonText: payload.buttonText || 'Ver opções',
          sections: payload.sections || [],
          isGroup,
        };
        messageForDb = `[Lista] ${payload.message || payload.title || ''}`;
        break;

      case 'link':
        endpoint = `${baseUrl}/v1/message/send-link?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          url: payload.url || '',
          title: payload.linkTitle || '',
          description: payload.linkDescription || '',
          previewImage: payload.linkPreviewImage || '',
          isGroup,
        };
        messageForDb = `[Link] ${payload.url || ''}`;
        break;

      case 'sticker':
        endpoint = `${baseUrl}/v1/message/send-sticker?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          sticker: payload.stickerUrl || '',
          isGroup,
        };
        messageForDb = '[Sticker]';
        break;

      case 'location':
        endpoint = `${baseUrl}/v1/message/send-location?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          lat: payload.latitude || 0,
          lng: payload.longitude || 0,
          name: payload.locationName || '',
          address: payload.address || '',
          isGroup,
        };
        messageForDb = `[Localização] ${payload.locationName || 'Localização compartilhada'}`;
        break;

      case 'contact':
        endpoint = `${baseUrl}/v1/message/send-contact?instanceId=${instanceId}`;
        requestBody = {
          phone: formattedPhone,
          contact: {
            name: payload.contactName || '',
            phone: payload.contactPhone || '',
          },
          isGroup,
        };
        messageForDb = `[Contato] ${payload.contactName || ''}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Tipo de mensagem inválido: ${messageType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`=== W-API Send Advanced (${messageType}) ===`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Body: ${JSON.stringify(requestBody)}`);

    // Save message BEFORE sending (resilience pattern)
    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: formattedPhone,
        message: messageForDb,
        direction: 'outgoing',
        status: 'pending',
        media_type: messageType,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('Error saving message:', saveError);
    }

    const savedMsgId = savedMsg?.id;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`Response ${response.status}: ${responseText.slice(0, 500)}`);

    // deno-lint-ignore no-explicit-any
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Non-JSON response from W-API');
    }

    if (response.ok) {
      const wapiMessageId = (parsed?.id || parsed?.key?.id || parsed?.messageId || null) as string | null;
      if (savedMsgId) {
        await supabase
          .from('whatsapp_messages')
          .update({
            status: 'sent',
            wapi_message_id: wapiMessageId,
          })
          .eq('id', savedMsgId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageType,
          data: parsed,
          messageId: savedMsgId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request failed
    if (savedMsgId) {
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed' })
        .eq('id', savedMsgId);
    }

    return new Response(
      JSON.stringify({
        error: 'Erro na W-API',
        status: response.status,
        details: parsed,
      }),
      { status: response.status >= 400 && response.status < 600 ? response.status : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-send-advanced:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
