import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Importa pagamentos recebidos no Asaas que ainda não existem no DB local.
// Cobre falhas de webhook, PIX automáticos e baixas em caixa feitas direto no Asaas.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let daysBack = 7;
    try {
      const body = await req.json();
      if (body?.days_back) daysBack = Number(body.days_back);
    } catch {}

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settings } = await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['ASAAS_API_KEY', 'ASAAS_ENVIRONMENT']);
    const apiKey = settings?.find((s: any) => s.key === 'ASAAS_API_KEY')?.value;
    const env = settings?.find((s: any) => s.key === 'ASAAS_ENVIRONMENT')?.value || 'sandbox';
    if (!apiKey) throw new Error('ASAAS_API_KEY ausente');
    const baseUrl = env === 'production'
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Janela em UTC-3
    const today = new Date();
    const from = new Date(today.getTime() - daysBack * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dateFrom = fmt(from);
    const dateTo = fmt(today);

    // Busca receitas paginadas no Asaas
    const statuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    const asaasReceipts: any[] = [];
    for (const status of statuses) {
      let offset = 0;
      const pageSize = 100;
      while (true) {
        const url = `${baseUrl}/payments?status=${status}&paymentDate[ge]=${dateFrom}&paymentDate[le]=${dateTo}&limit=${pageSize}&offset=${offset}`;
        const r = await fetch(url, { headers: { access_token: apiKey } });
        const d = await r.json();
        const items = d?.data || [];
        asaasReceipts.push(...items);
        if (items.length < pageSize) break;
        offset += pageSize;
        if (offset > 500) break; // safety
      }
    }

    if (asaasReceipts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma receita no período', imported: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // IDs já existentes
    const ids = asaasReceipts.map(p => p.id);
    const { data: existing } = await supabase
      .from('payments')
      .select('asaas_payment_id')
      .in('asaas_payment_id', ids);
    const existingSet = new Set((existing || []).map((p: any) => p.asaas_payment_id));

    const missing = asaasReceipts.filter(p => !existingSet.has(p.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Tudo sincronizado', imported: 0, fetched: asaasReceipts.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mapeia customer_id -> guardian
    const customerIds = [...new Set(missing.map(p => p.customer))];
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, asaas_customer_id')
      .in('asaas_customer_id', customerIds);
    const guardianMap = new Map((guardians || []).map((g: any) => [g.asaas_customer_id, g.id]));

    let imported = 0;
    const orphans: any[] = [];
    for (const p of missing) {
      const guardianId = guardianMap.get(p.customer);
      if (!guardianId) {
        orphans.push({ asaas_payment_id: p.id, customer: p.customer, value: p.value });
        continue;
      }
      const { error: insErr } = await supabase.from('payments').insert({
        guardian_id: guardianId,
        asaas_payment_id: p.id,
        value: p.value,
        status: p.status,
        billing_type: p.billingType,
        due_date: p.dueDate,
        payment_date: p.paymentDate,
        description: p.description || 'Pagamento Asaas',
        invoice_url: p.invoiceUrl || null,
        bank_slip_url: p.bankSlipUrl || null,
      });
      if (!insErr) imported++;
      else console.error('Erro insert', p.id, insErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      fetched: asaasReceipts.length,
      missing: missing.length,
      imported,
      orphans: orphans.length,
      orphan_details: orphans,
      window: { from: dateFrom, to: dateTo },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
