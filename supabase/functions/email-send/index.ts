import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailSendRequest {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SMTP configuration from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "email_smtp_host",
        "email_smtp_port",
        "email_smtp_user",
        "email_smtp_password",
        "email_smtp_secure",
        "email_from_address",
        "email_from_name",
      ]);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const configMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

    const smtpHost = configMap.get("email_smtp_host");
    const smtpPort = configMap.get("email_smtp_port");
    const smtpUser = configMap.get("email_smtp_user");
    const smtpPassword = configMap.get("email_smtp_password");
    const fromAddress = configMap.get("email_from_address") || smtpUser;
    const fromName = configMap.get("email_from_name") || "Sistema";

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email configuration not complete. Please configure SMTP settings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, cc, subject, body, isHtml = false }: EmailSendRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: to, subject, body",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use nodemailer to send email
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: configMap.get("email_smtp_secure") !== "false" && parseInt(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const toAddresses = Array.isArray(to) ? to : [to];
    const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

    const mailOptions: any = {
      from: `"${fromName}" <${fromAddress}>`,
      to: toAddresses.join(", "),
      subject: subject,
    };

    if (ccAddresses.length > 0) {
      mailOptions.cc = ccAddresses.join(", ");
    }

    if (isHtml) {
      mailOptions.html = body;
    } else {
      mailOptions.text = body;
    }

    const info = await transporter.sendMail(mailOptions);

    // Save to database
    const messageId = info.messageId || `sent-${Date.now()}`;
    const { error: insertError } = await supabase.from("email_messages").insert({
      message_id: messageId,
      from_address: fromAddress,
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      subject: subject,
      body_text: isHtml ? "" : body,
      body_html: isHtml ? body : "",
      received_at: new Date().toISOString(),
      is_read: true,
      folder: "SENT",
      direction: "outbound",
    });

    if (insertError) {
      console.error("Failed to save sent email:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        accepted: info.accepted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
