import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface ProfilePictureRequest {
  phone: string;
  guardianId?: string;
  updateDatabase?: boolean;
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

    const { phone, guardianId, updateDatabase = false }: ProfilePictureRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const chatId = `${formattedPhone}@c.us`;

    const baseUrl = (config.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
    const instanceId = encodeURIComponent(config.W_API_SESSION);

    // Endpoint oficial da W-API PRO: /v1/chats/get-profile-picture
    const endpoint = `${baseUrl}/v1/chats/get-profile-picture?instanceId=${instanceId}`;

    console.log(`=== W-API Get Profile Picture ===`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Chat ID: ${chatId}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.W_API_TOKEN}`,
      },
      body: JSON.stringify({ chatId }),
    });

    const responseText = await response.text();
    console.log(`Response ${response.status}: ${responseText.slice(0, 500)}`);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `W-API retornou ${response.status}`,
          details: responseText.slice(0, 200)
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let profilePictureUrl: string | null = null;
    
    try {
      const data = JSON.parse(responseText);
      // A W-API pode retornar em diferentes formatos
      profilePictureUrl = data.profilePictureUrl || 
                          data.profilePicThumbObj?.img || 
                          data.url || 
                          data.imgUrl ||
                          data.result?.profilePictureUrl ||
                          data.result?.url ||
                          null;
    } catch {
      console.error('Failed to parse response as JSON');
    }

    // Se solicitado, atualiza o banco de dados
    if (updateDatabase && guardianId && profilePictureUrl) {
      const { error: updateError } = await supabase
        .from('guardians')
        .update({ avatar_url: profilePictureUrl })
        .eq('id', guardianId);

      if (updateError) {
        console.error('Error updating guardian avatar:', updateError);
      } else {
        console.log(`Guardian ${guardianId} avatar updated successfully`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profilePictureUrl,
        phone: formattedPhone,
        guardianId,
        updated: updateDatabase && guardianId && profilePictureUrl ? true : false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in wapi-get-profile-picture:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
