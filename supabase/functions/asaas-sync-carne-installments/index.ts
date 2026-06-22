import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Sincroniza TODAS as parcelas de um carnê (ou de todos os carnês) com o Asaas.
 *
 * Motivo: durante a criação do carnê via Asaas (POST /payments com installmentCount),
 * apenas a 1ª parcela retornada normalmente é gravada localmente em `payments`.
 * As parcelas seguintes só são inseridas quando o webhook dispara - se o webhook
 * falhar ou estiver desligado, o sistema fica sem as parcelas 2..N e a tela
 * de Antecipação / Carnês mostra valor errado.
 *
 * Esta função busca em /payments?installment=<asaas_installment_id>&limit=100
 * todas as parcelas de cada carnê e faz UPSERT por asaas_payment_id, preservando
 * o vínculo com enrollment_id / contract_id / guardian_id.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: claims.claims.sub,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const carneId: string | null = body?.carne_id || null;

    const { data: keySetting } = await admin
      .from('app_settings').select('value').eq('key', 'ASAAS_API_KEY').maybeSingle();
    const { data: envSetting } = await admin
      .from('app_settings').select('value').eq('key', 'ASAAS_ENVIRONMENT').maybeSingle();
    const apiKey = keySetting?.value?.trim();
    if (!apiKey) return json({ error: 'ASAAS_API_KEY não configurada' }, 400);
    const baseUrl = envSetting?.value === 'production'
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';

    let query = admin
      .from('carnes')
      .select('id, enrollment_id, guardian_id, contract_id, asaas_installment_id, installment_count')
      .not('asaas_installment_id', 'is', null);
    if (carneId) query = query.eq('id', carneId);
    const { data: carnes, error: carnesErr } = await query;
    if (carnesErr) return json({ error: carnesErr.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const carne of carnes ?? []) {
      const installmentId = carne.asaas_installment_id;
      let inserted = 0;
      let updated = 0;
      let fetched = 0;
      const errors: string[] = [];

      let offset = 0;
      const pageSize = 100;
      const asaasPayments: any[] = [];
      while (true) {
        const url = `${baseUrl}/payments?installment=${installmentId}&limit=${pageSize}&offset=${offset}`;
        const r = await fetch(url, { headers: { access_token: apiKey, accept: 'application/json' } });
        if (!r.ok) {
          errors.push(`asaas ${r.status}: ${await r.text()}`);
          break;
        }
        const d = await r.json();
        const items = d?.data || [];
        asaasPayments.push(...items);
        fetched += items.length;
        if (items.length < pageSize) break;
        offset += pageSize;
        if (offset > 500) break;
      }

      const ids = asaasPayments.map(p => p.id);
      const { data: existing } = await admin
        .from('payments')
        .select('id, asaas_payment_id')
        .in('asaas_payment_id', ids.length ? ids : ['__none__']);
      const existingMap = new Map((existing ?? []).map((p: any) => [p.asaas_payment_id, p.id]));

      for (const p of asaasPayments) {
        const payload = {
          guardian_id: carne.guardian_id,
          enrollment_id: carne.enrollment_id,
          contract_id: carne.contract_id,
          asaas_payment_id: p.id,
          asaas_installment_id: installmentId,
          installment_number: p.installmentNumber ?? null,
          value: p.value,
          status: p.status,
          billing_type: p.billingType,
          due_date: p.dueDate,
          payment_date: p.paymentDate ?? null,
          description: p.description || 'Parcela do carnê',
          invoice_url: p.invoiceUrl ?? null,
          bank_slip_url: p.bankSlipUrl ?? null,
          external_reference: p.externalReference ?? null,
          updated_at: new Date().toISOString(),
        };
        const existingId = existingMap.get(p.id);
        if (existingId) {
          const { error: upErr } = await admin.from('payments').update(payload).eq('id', existingId);
          if (upErr) errors.push(`update ${p.id}: ${upErr.message}`);
          else updated++;
        } else {
          const { error: insErr } = await admin.from('payments').insert(payload);
          if (insErr) errors.push(`insert ${p.id}: ${insErr.message}`);
          else inserted++;
        }
      }

      totalInserted += inserted;
      totalUpdated += updated;
      results.push({
        carne_id: carne.id,
        asaas_installment_id: installmentId,
        expected: carne.installment_count,
        fetched,
        inserted,
        updated,
        errors: errors.length ? errors : undefined,
      });
    }

    return json({
      ok: true,
      carnes_processed: carnes?.length || 0,
      total_inserted: totalInserted,
      total_updated: totalUpdated,
      results,
    });
  } catch (e) {
    console.error('asaas-sync-carne-installments error:', e);
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
