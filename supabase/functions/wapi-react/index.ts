import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface ReactRequest {
  messageId: string;
  emoji: string; // E.g., "👍", "❤️", "✅", or emoji shortcode
}

// Map common emoji shortcodes to actual emojis
const emojiMap: Record<string, string> = {
  'thumbsup': '👍',
  'thumbs_up': '👍',
  'like': '👍',
  'heart': '❤️',
  'love': '❤️',
  'check': '✅',
  'ok': '👌',
  'clap': '👏',
  'fire': '🔥',
  'star': '⭐',
  'smile': '😊',
  'laugh': '😂',
  'cry': '😢',
  'angry': '😠',
  'thinking': '🤔',
};

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

    const { messageId, emoji }: ReactRequest = await req.json();

    if (!messageId || !emoji) {
      return new Response(
        JSON.stringify({ error: 'messageId e emoji são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert emoji shortcode to actual emoji if needed
    const actualEmoji = emojiMap[emoji.toLowerCase()] || emoji;

    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const instanceId = encodeURIComponent(config.W_API_SESSION);
    const endpoint = `${baseUrl}/v1/message/react?instanceId=${instanceId}`;

    console.log(`=== W-API React ===`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Message ID: ${messageId}`);
    console.log(`Emoji: ${actualEmoji}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({ 
        messageId,
        emoji: actualEmoji,
      }),
    });

    const responseText = await response.text();
    console.log(`Response ${response.status}: ${responseText.slice(0, 200)}`);

    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Ignore parse errors
    }

    return new Response(
      JSON.stringify({ success: response.ok, emoji: actualEmoji, data: parsed }),
      { status: response.ok ? 200 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-react:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
