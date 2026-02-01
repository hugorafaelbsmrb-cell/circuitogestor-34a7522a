import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailFetchRequest {
  folder?: string;
  limit?: number;
}

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IMAP configuration from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "email_imap_host",
        "email_imap_port",
        "email_imap_user",
        "email_imap_password",
        "email_imap_tls",
      ]);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const configMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

    const imapHost = configMap.get("email_imap_host");
    const imapPort = configMap.get("email_imap_port");
    const imapUser = configMap.get("email_imap_user");
    const imapPassword = configMap.get("email_imap_password");

    if (!imapHost || !imapPort || !imapUser || !imapPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email configuration not complete. Please configure IMAP settings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { folder = "INBOX", limit = 50 }: EmailFetchRequest = await req.json().catch(() => ({}));

    // Use ImapFlow to fetch emails
    const { ImapFlow } = await import("imapflow");

    const client = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort),
      secure: configMap.get("email_imap_tls") !== "false",
      auth: {
        user: imapUser,
        pass: imapPassword,
      },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock(folder);
    const messages: any[] = [];

    try {
      // Get latest messages
      const messageCount = client.mailbox?.exists || 0;
      const startSeq = Math.max(1, messageCount - limit + 1);

      for await (const message of client.fetch(`${startSeq}:*`, {
        envelope: true,
        bodyStructure: true,
        source: true,
        flags: true,
        uid: true,
      })) {
        const envelope = message.envelope;
        
        // Parse the email source to get body
        let bodyText = "";
        let bodyHtml = "";
        
        if (message.source) {
          const sourceStr = message.source.toString();
          
          // Simple parsing for text/plain
          const textMatch = sourceStr.match(/Content-Type: text\/plain[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\n)/i);
          if (textMatch) {
            bodyText = textMatch[1].trim();
          }
          
          // Simple parsing for text/html
          const htmlMatch = sourceStr.match(/Content-Type: text\/html[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\n)/i);
          if (htmlMatch) {
            bodyHtml = htmlMatch[1].trim();
          }
          
          // If no multipart, try to get plain body
          if (!bodyText && !bodyHtml) {
            const bodyStart = sourceStr.indexOf("\r\n\r\n");
            if (bodyStart !== -1) {
              bodyText = sourceStr.substring(bodyStart + 4).trim();
            }
          }
        }

        messages.push({
          message_id: envelope?.messageId || `${message.uid}-${Date.now()}`,
          from_address: envelope?.from?.[0]?.address || "unknown",
          to_addresses: envelope?.to?.map((t: any) => t.address) || [],
          cc_addresses: envelope?.cc?.map((c: any) => c.address) || [],
          subject: envelope?.subject || "(Sem assunto)",
          body_text: bodyText,
          body_html: bodyHtml,
          received_at: envelope?.date?.toISOString() || new Date().toISOString(),
          is_read: message.flags?.has("\\Seen") || false,
          is_starred: message.flags?.has("\\Flagged") || false,
          folder: folder,
          direction: "inbound",
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // Upsert messages to database
    if (messages.length > 0) {
      const { error: upsertError } = await supabase
        .from("email_messages")
        .upsert(messages, {
          onConflict: "message_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: messages.length,
        messages: messages.map((m) => ({
          message_id: m.message_id,
          from_address: m.from_address,
          subject: m.subject,
          received_at: m.received_at,
          is_read: m.is_read,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email fetch error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
