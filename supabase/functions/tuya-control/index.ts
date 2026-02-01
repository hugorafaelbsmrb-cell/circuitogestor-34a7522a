import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tuya API signature generation
async function generateSignature(
  clientId: string,
  clientSecret: string,
  timestamp: string,
  accessToken: string,
  nonce: string,
  method: string,
  path: string,
  body: string = ''
): Promise<string> {
  const bodyHash = body 
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
        .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // empty string hash

  const stringToSign = [
    method,
    bodyHash,
    '',
    path
  ].join('\n');

  const signStr = clientId + (accessToken || '') + timestamp + nonce + stringToSign;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signStr));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Get Tuya access token
async function getTuyaToken(clientId: string, clientSecret: string, endpoint: string): Promise<string> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const path = '/v1.0/token?grant_type=1';
  
  const signature = await generateSignature(
    clientId,
    clientSecret,
    timestamp,
    '',
    nonce,
    'GET',
    path
  );

  const response = await fetch(`${endpoint}${path}`, {
    method: 'GET',
    headers: {
      'client_id': clientId,
      'sign': signature,
      't': timestamp,
      'sign_method': 'HMAC-SHA256',
      'nonce': nonce,
    },
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to get Tuya token: ${data.msg}`);
  }
  
  return data.result.access_token;
}

// Make authenticated Tuya API request
async function tuyaRequest(
  clientId: string,
  clientSecret: string,
  endpoint: string,
  accessToken: string,
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const bodyStr = body ? JSON.stringify(body) : '';
  
  const signature = await generateSignature(
    clientId,
    clientSecret,
    timestamp,
    accessToken,
    nonce,
    method,
    path,
    bodyStr
  );

  const headers: Record<string, string> = {
    'client_id': clientId,
    'access_token': accessToken,
    'sign': signature,
    't': timestamp,
    'sign_method': 'HMAC-SHA256',
    'nonce': nonce,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Tuya credentials from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['tuya_client_id', 'tuya_client_secret', 'tuya_api_endpoint']);

    if (settingsError) {
      throw new Error('Failed to fetch Tuya settings');
    }

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const clientId = settingsMap['tuya_client_id'];
    const clientSecret = settingsMap['tuya_client_secret'];
    const endpoint = settingsMap['tuya_api_endpoint'] || 'https://openapi.tuyaus.com';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tuya credentials not configured. Please add tuya_client_id and tuya_client_secret in settings.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, deviceId, command, value } = await req.json();

    // Get access token
    const accessToken = await getTuyaToken(clientId, clientSecret, endpoint);

    let result;

    switch (action) {
      case 'list_devices': {
        // Get user's device list
        const devicesResponse = await tuyaRequest(
          clientId, clientSecret, endpoint, accessToken,
          'GET', '/v1.0/users/me/devices'
        );
        
        if (!devicesResponse.success) {
          throw new Error(devicesResponse.msg || 'Failed to list devices');
        }

        // Sync devices to database
        const devices = devicesResponse.result || [];
        for (const device of devices) {
          await supabase
            .from('iot_devices')
            .upsert({
              tuya_device_id: device.id,
              name: device.name,
              category: device.category,
              is_online: device.online,
              is_on: device.status?.find((s: any) => s.code.includes('switch'))?.value || false,
              last_status: device.status,
              last_sync_at: new Date().toISOString(),
            }, { onConflict: 'tuya_device_id' });
        }

        result = { devices };
        break;
      }

      case 'control': {
        if (!deviceId || !command) {
          throw new Error('deviceId and command are required');
        }

        const controlResponse = await tuyaRequest(
          clientId, clientSecret, endpoint, accessToken,
          'POST', `/v1.0/devices/${deviceId}/commands`,
          { commands: [{ code: command, value }] }
        );

        if (!controlResponse.success) {
          throw new Error(controlResponse.msg || 'Failed to control device');
        }

        // Update device status in database
        await supabase
          .from('iot_devices')
          .update({ 
            is_on: value,
            last_sync_at: new Date().toISOString()
          })
          .eq('tuya_device_id', deviceId);

        result = { success: true };
        break;
      }

      case 'get_status': {
        if (!deviceId) {
          throw new Error('deviceId is required');
        }

        const statusResponse = await tuyaRequest(
          clientId, clientSecret, endpoint, accessToken,
          'GET', `/v1.0/devices/${deviceId}/status`
        );

        if (!statusResponse.success) {
          throw new Error(statusResponse.msg || 'Failed to get device status');
        }

        result = { status: statusResponse.result };
        break;
      }

      case 'test_connection': {
        // Just try to get token - if successful, credentials are valid
        result = { success: true, message: 'Connection successful' };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Tuya control error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
