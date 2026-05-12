import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { customerId, dateFrom, dateTo } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings } = await supabase.from('app_settings').select('key,value').in('key',['ASAAS_API_KEY','ASAAS_ENVIRONMENT']);
    const apiKey = settings?.find((s:any)=>s.key==='ASAAS_API_KEY')?.value;
    const env = settings?.find((s:any)=>s.key==='ASAAS_ENVIRONMENT')?.value || 'sandbox';
    const baseUrl = env==='production' ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const url = `${baseUrl}/payments?customer=${customerId}&paymentDate[ge]=${dateFrom}&paymentDate[le]=${dateTo}&limit=100`;
    const r = await fetch(url, { headers: { 'access_token': apiKey } });
    const d = await r.json();
    return new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type':'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({error:String(e)}), {status:500, headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
