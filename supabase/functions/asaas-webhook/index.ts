import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

interface AsaasWebhookPayment {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  billingType: string;
  dueDate: string;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
  externalReference?: string;
  installment?: string;
}

interface AsaasWebhookEvent {
  event: string;
  payment?: AsaasWebhookPayment;
}

const mapPaymentStatus = (asaasStatus: string): string => {
  const statusMap: Record<string, string> = {
    PENDING: "PENDING",
    RECEIVED: "RECEIVED",
    CONFIRMED: "CONFIRMED",
    OVERDUE: "OVERDUE",
    REFUNDED: "REFUNDED",
    RECEIVED_IN_CASH: "RECEIVED_IN_CASH",
  };
  return statusMap[asaasStatus] || asaasStatus;
};

async function processPaymentEvent(supabaseUrl: string, supabaseKey: string, event: string, payment: AsaasWebhookPayment) {
  console.log(`Processing payment event: ${event} for payment ${payment.id}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const status = mapPaymentStatus(payment.status);
  
  // Update payment by Asaas ID
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();
  
  if (existingPayment) {
    await supabase
      .from("payments")
      .update({
        status,
        payment_date: payment.paymentDate || null,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("asaas_payment_id", payment.id);
    
    console.log(`Payment updated to status: ${status}`);
  } else if (payment.externalReference) {
    // Try by external reference
    await supabase
      .from("payments")
      .update({
        asaas_payment_id: payment.id,
        status,
        payment_date: payment.paymentDate || null,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("enrollment_id", payment.externalReference)
      .is("asaas_payment_id", null);
    
    console.log(`Payment linked by external reference`);
  }
  
  // Update carnê if applicable
  if (payment.installment) {
    const { data: installmentPayments } = await supabase
      .from("payments")
      .select("status")
      .eq("asaas_installment_id", payment.installment);
    
    if (installmentPayments && installmentPayments.length > 0) {
      const allPaid = installmentPayments.every((p: { status: string }) => 
        ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status)
      );
      
      if (allPaid) {
        await supabase
          .from("carnes")
          .update({ status: "ENDED", updated_at: new Date().toISOString() })
          .eq("asaas_installment_id", payment.installment);
        
        console.log(`Carnê ${payment.installment} marked as ENDED`);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const body: AsaasWebhookEvent = await req.json();
    console.log("Received Asaas webhook:", JSON.stringify(body, null, 2));
    
    const { event, payment } = body;
    
    if (!event) {
      throw new Error("Missing event type");
    }
    
    if (payment) {
      await processPaymentEvent(supabaseUrl, supabaseKey, event, payment);
    }
    
    return new Response(
      JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
