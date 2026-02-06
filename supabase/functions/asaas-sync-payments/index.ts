import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  paymentDate: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
}

const mapAsaasStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    PENDING: "PENDING",
    RECEIVED: "RECEIVED",
    CONFIRMED: "CONFIRMED",
    OVERDUE: "OVERDUE",
    REFUNDED: "REFUNDED",
    RECEIVED_IN_CASH: "RECEIVED_IN_CASH",
    REFUND_REQUESTED: "REFUND_REQUESTED",
    REFUND_IN_PROGRESS: "REFUND_IN_PROGRESS",
    CHARGEBACK_REQUESTED: "CHARGEBACK_REQUESTED",
    CHARGEBACK_DISPUTE: "CHARGEBACK_DISPUTE",
    AWAITING_CHARGEBACK_REVERSAL: "AWAITING_CHARGEBACK_REVERSAL",
    DUNNING_REQUESTED: "DUNNING_REQUESTED",
    DUNNING_RECEIVED: "DUNNING_RECEIVED",
    AWAITING_RISK_ANALYSIS: "AWAITING_RISK_ANALYSIS",
  };
  return statusMap[status] || status;
};

async function getAsaasConfig(supabase: any): Promise<AsaasConfig> {
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"]);
  
  if (error) {
    console.error("Erro ao buscar configurações:", error);
    throw new Error("Erro ao buscar configurações do Asaas");
  }
  
  const apiKey = settings?.find((s: any) => s.key === "ASAAS_API_KEY")?.value;
  const environment = settings?.find((s: any) => s.key === "ASAAS_ENVIRONMENT")?.value || "sandbox";
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada no banco de dados");
  }
  
  const isProduction = environment === "production";
  const baseUrl = isProduction 
    ? "https://www.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
  
  console.log("Asaas Config - Ambiente:", isProduction ? "PRODUÇÃO" : "SANDBOX");
  console.log("Asaas Config - URL:", baseUrl);
  
  return { apiKey, baseUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body for optional payment_id filter
    let paymentId: string | null = null;
    let limit = 10; // Default limit
    try {
      const body = await req.json();
      paymentId = body.payment_id || null;
      limit = body.limit || 10;
    } catch {
      // No body, use defaults
    }
    
    // Get Asaas configuration from database
    const asaasConfig = await getAsaasConfig(supabase);

    // Get payments to sync - either specific or limited OVERDUE ones
    let query = supabase
      .from("payments")
      .select("id, asaas_payment_id, status")
      .not("asaas_payment_id", "is", null);
    
    if (paymentId) {
      query = query.eq("asaas_payment_id", paymentId);
    } else {
      // Only sync OVERDUE payments (most important), with limit
      query = query.eq("status", "OVERDUE").limit(limit);
    }

    const { data: localPayments, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch local payments: ${fetchError.message}`);
    }

    if (!localPayments || localPayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No payments to sync", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${localPayments.length} payments to check`);

    let updatedCount = 0;
    const errors: string[] = [];
    const details: { id: string; from: string; to: string }[] = [];

    // Process each payment
    for (const localPayment of localPayments) {
      try {
        // Fetch payment status from Asaas
        const asaasResponse = await fetch(
          `${asaasConfig.baseUrl}/payments/${localPayment.asaas_payment_id}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "accept": "application/json",
              "access_token": asaasConfig.apiKey,
              "user-agent": "CircuitoGestor/1.0",
            },
          }
        );

        if (!asaasResponse.ok) {
          const errorText = await asaasResponse.text();
          console.error(`Asaas API error for ${localPayment.asaas_payment_id}: status ${asaasResponse.status}`);
          errors.push(`${localPayment.asaas_payment_id}: API error (${asaasResponse.status})`);
          continue;
        }

        const asaasPayment: AsaasPayment = await asaasResponse.json();
        const mappedStatus = mapAsaasStatus(asaasPayment.status);

        console.log(`Payment ${localPayment.asaas_payment_id}: Asaas status = ${asaasPayment.status}, Local status = ${localPayment.status}`);

        // If status changed, update local database
        if (mappedStatus !== localPayment.status) {
          console.log(`Updating payment ${localPayment.id}: ${localPayment.status} -> ${mappedStatus}`);
          
          const { error: updateError } = await supabase
            .from("payments")
            .update({
              status: mappedStatus,
              payment_date: asaasPayment.paymentDate || null,
              invoice_url: asaasPayment.invoiceUrl,
              bank_slip_url: asaasPayment.bankSlipUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", localPayment.id);

          if (updateError) {
            console.error(`Failed to update payment ${localPayment.id}: ${updateError.message}`);
            errors.push(`${localPayment.id}: update failed`);
          } else {
            updatedCount++;
            details.push({
              id: localPayment.asaas_payment_id,
              from: localPayment.status,
              to: mappedStatus,
            });
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error processing payment ${localPayment.id}:`, err);
        errors.push(`${localPayment.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${updatedCount} of ${localPayments.length} payments`,
        updated: updatedCount,
        total: localPayments.length,
        details: details.length > 0 ? details : undefined,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
