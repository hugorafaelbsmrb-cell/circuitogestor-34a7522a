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
    
    // Send via W-API - using correct v1 endpoint format
    const wapiUrl = wapiConfig.W_API_URL.replace(/\/$/, '');
    const encodedInstanceId = encodeURIComponent(wapiConfig.W_API_SESSION);
    const response = await fetch(`${wapiUrl}/v1/message/send-text?instanceId=${encodedInstanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wapiConfig.W_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
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

async function processCampEnrollment(supabase: any, payment: AsaasWebhookPayment, status: string) {
  const ref = payment.externalReference || "";
  // Format: camp_<id>  OR  camp_<id>_pix  OR  camp_<id>_cc
  const m = ref.match(/^camp_(.+?)(?:_(pix|cc))?$/);
  if (!m) return;
  const enrollmentId = m[1];
  const part = m[2] as "pix" | "cc" | undefined;

  const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status);

  const { data: enrollment } = await supabase
    .from("vacation_camp_enrollments")
    .select("id, package_id, payment_status, payment_method, split_pix_paid, split_card_paid, asaas_payment_id, asaas_payment_id_2")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) {
    console.warn(`Camp enrollment ${enrollmentId} not found for payment ${payment.id}`);
    return;
  }

  const wasConfirmed = enrollment.payment_status === "confirmed";
  const isSplit = enrollment.payment_method === "SPLIT";

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (isSplit && part) {
    if (part === "pix") updates.split_pix_paid = isPaid;
    if (part === "cc") updates.split_card_paid = isPaid;
    const pixPaid = part === "pix" ? isPaid : !!enrollment.split_pix_paid;
    const cardPaid = part === "cc" ? isPaid : !!enrollment.split_card_paid;
    const bothPaid = pixPaid && cardPaid;
    updates.payment_status = bothPaid ? "confirmed" : status === "OVERDUE" ? "overdue" : "pending";
    if (bothPaid && !wasConfirmed) updates.confirmed_at = new Date().toISOString();
  } else {
    const newStatus = isPaid ? "confirmed" : status === "OVERDUE" ? "overdue" : "pending";
    updates.payment_status = newStatus;
    updates.asaas_payment_id = payment.id;
    updates.asaas_invoice_url = payment.invoiceUrl;
    updates.asaas_bank_slip_url = payment.bankSlipUrl;
    if (isPaid && !wasConfirmed) updates.confirmed_at = new Date().toISOString();
  }

  await supabase
    .from("vacation_camp_enrollments")
    .update(updates)
    .eq("id", enrollmentId);

  const becameConfirmed = updates.payment_status === "confirmed" && !wasConfirmed;

  // Increment sold_count on first confirmation
  if (becameConfirmed && enrollment.package_id) {
    const { data: pkg } = await supabase
      .from("vacation_camp_packages")
      .select("sold_count")
      .eq("id", enrollment.package_id)
      .maybeSingle();
    if (pkg) {
      await supabase
        .from("vacation_camp_packages")
        .update({ sold_count: (pkg.sold_count || 0) + 1 })
        .eq("id", enrollment.package_id);
    }
  }

  // Notify guardian via WhatsApp on first confirmation
  if (becameConfirmed) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/vacation-camp-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: JSON.stringify({ event: "payment_confirmed", enrollment_id: enrollmentId }),
      });
    } catch (notifyErr) {
      console.warn("notify payment_confirmed failed:", notifyErr);
    }
  }

  console.log(`✅ Camp enrollment ${enrollmentId}${part ? `[${part}]` : ""} -> ${updates.payment_status}`);
}

async function processPaymentEvent(supabaseUrl: string, supabaseKey: string, event: string, payment: AsaasWebhookPayment) {
  console.log(`Processing payment event: ${event} for payment ${payment.id}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const status = mapPaymentStatus(payment.status);

  // Camp enrollment handling (externalReference starts with camp_)
  if (payment.externalReference?.startsWith("camp_")) {
    await processCampEnrollment(supabase, payment, status);
    return;
  }
  
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
        value: payment.value,
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
          supabase, supabaseUrl, supabaseKey,
          guardian.id, guardian.name, guardian.phone,
          payment.value, payment.paymentDate || new Date().toISOString()
        );
      }
    }
  } else {
    // Auto-create payment record when not found in system (PIX automáticos do Asaas)
    // Link by asaas_customer_id
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id, name, phone")
      .eq("asaas_customer_id", payment.customer)
      .maybeSingle();
    
    if (guardian) {
      const { error: insertError } = await supabase.from("payments").insert({
        guardian_id: guardian.id,
        asaas_payment_id: payment.id,
        description: payment.description || "Cobrança Asaas (importação automática)",
        value: payment.value,
        due_date: payment.dueDate,
        payment_date: payment.paymentDate || null,
        status,
        billing_type: payment.billingType,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
      });
      
      if (insertError) {
        console.error(`Failed to auto-create payment ${payment.id}:`, insertError);
      } else {
        console.log(`✅ Auto-created payment ${payment.id} for guardian ${guardian.name}`);
        
        if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status)) {
          await sendPaymentConfirmationWhatsApp(
            supabase, supabaseUrl, supabaseKey,
            guardian.id, guardian.name, guardian.phone,
            payment.value, payment.paymentDate || new Date().toISOString()
          );
        }
      }
    } else {
      console.warn(`⚠️ Payment ${payment.id} - cliente Asaas ${payment.customer} não corresponde a nenhum responsável no sistema`);
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
