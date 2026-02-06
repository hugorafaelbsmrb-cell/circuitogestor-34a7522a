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

async function sendPaymentConfirmationWhatsApp(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  guardianId: string,
  guardianName: string,
  guardianPhone: string,
  paymentValue: number,
  paymentDate: string
) {
  try {
    // Check if automation is enabled
    const { data: automationSetting } = await supabase
      .from('automation_settings')
      .select('enabled')
      .eq('key', 'auto_payment_confirmed')
      .single();
    
    if (!automationSetting?.enabled) {
      console.log('Payment confirmation automation is disabled');
      return;
    }
    
    // Get template for payment_confirmed
    const { data: templates } = await supabase
      .from('app_settings')
      .select('value')
      .like('key', 'whatsapp_template_%');
    
    let templateMessage: string | null = null;
    for (const t of templates || []) {
      try {
        const parsed = JSON.parse(t.value);
        if (parsed.category === 'payment_confirmed' && parsed.is_active !== false) {
          templateMessage = parsed.message;
          break;
        }
      } catch {}
    }
    
    if (!templateMessage) {
      console.log('No template found for payment_confirmed');
      return;
    }
    
    // Get school name
    const { data: schoolSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'system_name')
      .single();
    
    const schoolName = schoolSetting?.value || 'Nossa Escola';
    
    // Get W-API config
    const { data: wapiSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);
    
    const wapiConfig: Record<string, string> = {};
    wapiSettings?.forEach((s: any) => {
      if (s.value) wapiConfig[s.key] = s.value;
    });
    
    if (!wapiConfig.W_API_URL || !wapiConfig.W_API_TOKEN || !wapiConfig.W_API_SESSION) {
      console.log('W-API not configured');
      return;
    }
    
    // Build message
    const message = templateMessage
      .replace(/{nome_responsavel}/g, guardianName)
      .replace(/{valor}/g, `R$ ${paymentValue.toFixed(2).replace('.', ',')}`)
      .replace(/{nome_escola}/g, schoolName);
    
    // Format phone
    const cleanPhone = guardianPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Send via W-API - using Bearer token authentication
    const wapiUrl = wapiConfig.W_API_URL.replace(/\/$/, '');
    const response = await fetch(`${wapiUrl}/message/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wapiConfig.W_API_TOKEN}`,
      },
      body: JSON.stringify({
        session: wapiConfig.W_API_SESSION,
        phone: formattedPhone,
        message: message,
        isGroup: false,
      }),
    });
    
    const success = response.ok;
    console.log(`Payment confirmation WhatsApp ${success ? 'sent' : 'failed'} to ${guardianName}`);
    
    // Log the message using service role key
    const adminClient = createClient(supabaseUrl, supabaseKey);
    await adminClient.from('message_logs').insert({
      guardian_id: guardianId,
      phone: guardianPhone,
      template_category: 'payment_confirmed',
      message_preview: message.substring(0, 100),
      automation_key: 'auto_payment_confirmed',
      status: success ? 'sent' : 'error',
      error_message: success ? null : 'Falha no envio',
    });
    
  } catch (error) {
    console.error('Error sending payment confirmation WhatsApp:', error);
  }
}

async function processPaymentEvent(supabaseUrl: string, supabaseKey: string, event: string, payment: AsaasWebhookPayment) {
  console.log(`Processing payment event: ${event} for payment ${payment.id}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const status = mapPaymentStatus(payment.status);
  
  // Update payment by Asaas ID
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, guardian_id")
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
    
    // If payment is confirmed, send WhatsApp notification
    if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status) && existingPayment.guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("id, name, phone")
        .eq("id", existingPayment.guardian_id)
        .single();
      
      if (guardian) {
        await sendPaymentConfirmationWhatsApp(
          supabase,
          supabaseUrl,
          supabaseKey,
          guardian.id,
          guardian.name,
          guardian.phone,
          payment.value,
          payment.paymentDate || new Date().toISOString()
        );
      }
    }
  } else if (payment.externalReference) {
    // Try by external reference
    const { data: updatedPayment } = await supabase
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
      .is("asaas_payment_id", null)
      .select("guardian_id")
      .maybeSingle();
    
    console.log(`Payment linked by external reference`);
    
    // If payment is confirmed, send WhatsApp notification
    if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status) && updatedPayment?.guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("id, name, phone")
        .eq("id", updatedPayment.guardian_id)
        .single();
      
      if (guardian) {
        await sendPaymentConfirmationWhatsApp(
          supabase,
          supabaseUrl,
          supabaseKey,
          guardian.id,
          guardian.name,
          guardian.phone,
          payment.value,
          payment.paymentDate || new Date().toISOString()
        );
      }
    }
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

// Verify webhook access token from Asaas
async function verifyWebhookToken(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get webhook secret from database
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "ASAAS_WEBHOOK_SECRET")
    .single();
  
  const webhookSecret = setting?.value;
  
  // If no secret configured, log warning but allow (backwards compatibility)
  if (!webhookSecret) {
    console.warn("⚠️ ASAAS_WEBHOOK_SECRET não configurado - webhook sem validação de segurança!");
    return true;
  }
  
  // Check for access token in header (Asaas sends as asaas-access-token)
  const accessToken = req.headers.get("asaas-access-token");
  
  if (!accessToken) {
    console.error("❌ Webhook request sem token de autenticação");
    return false;
  }
  
  if (accessToken !== webhookSecret) {
    console.error("❌ Token de webhook inválido");
    return false;
  }
  
  console.log("✅ Token de webhook validado com sucesso");
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Verify webhook authentication
    const isValidToken = await verifyWebhookToken(req);
    if (!isValidToken) {
      console.error("Webhook authentication failed - rejecting request");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid webhook token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
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
