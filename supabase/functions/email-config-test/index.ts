import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfigTestRequest {
  type: "imap" | "smtp";
  host: string;
  port: number;
  user: string;
  password: string;
  secure?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, host, port, user, password, secure = true }: ConfigTestRequest = await req.json();

    if (!host || !port || !user || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: host, port, user, password",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "imap") {
      // Test IMAP connection
      const { ImapFlow } = await import("imapflow");

      const client = new ImapFlow({
        host: host,
        port: port,
        secure: secure,
        auth: {
          user: user,
          pass: password,
        },
        logger: false,
      });

      try {
        await client.connect();
        
        // Get mailbox list to verify connection
        const mailboxes: string[] = [];
        for await (const mailbox of client.list()) {
          mailboxes.push(mailbox.path);
        }
        
        await client.logout();

        return new Response(
          JSON.stringify({
            success: true,
            message: "IMAP connection successful",
            mailboxes: mailboxes.slice(0, 10), // Return first 10 mailboxes
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (imapError: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `IMAP connection failed: ${imapError.message}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (type === "smtp") {
      // Test SMTP connection
      const nodemailer = await import("nodemailer");

      const transporter = nodemailer.default.createTransport({
        host: host,
        port: port,
        secure: secure && port === 465,
        auth: {
          user: user,
          pass: password,
        },
      });

      try {
        await transporter.verify();

        return new Response(
          JSON.stringify({
            success: true,
            message: "SMTP connection successful",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (smtpError: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `SMTP connection failed: ${smtpError.message}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid type. Must be 'imap' or 'smtp'",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Config test error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
