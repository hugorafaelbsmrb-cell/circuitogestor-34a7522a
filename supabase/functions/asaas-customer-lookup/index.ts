import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { customerIds } = await req.json();
    const apiKey = Deno.env.get('ASAAS_API_KEY')!;
    const isProduction = !apiKey.includes('hmlg') && !apiKey.includes('sandbox');
    const baseUrl = isProduction
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    const results: any[] = [];
    for (const cid of customerIds) {
      const r = await fetch(`${baseUrl}/customers/${cid}`, {
        headers: { 'access_token': apiKey },
      });
      const d = await r.json();
      results.push({
        customerId: cid,
        name: d.name,
        cpfCnpj: d.cpfCnpj,
        email: d.email,
        phone: d.mobilePhone || d.phone,
        error: d.errors,
      });
    }

    return new Response(JSON.stringify({ results, baseUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
