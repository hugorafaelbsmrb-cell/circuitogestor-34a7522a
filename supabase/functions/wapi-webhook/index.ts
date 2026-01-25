import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight - respond immediately
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Respond fast to avoid webhook timeout
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("W-API Webhook received:", JSON.stringify(payload, null, 2));

    // W-API sends different event types
    const event = payload.event || payload.type || "unknown";
    const data = payload.data || payload.message || payload;

    // ====== Handle MESSAGE RECEIVED ======
    if (event === "message" || event === "messages.upsert" || event === "message-received" || 
        (data.fromMe === false && data.body)) {
      
      const phone = data.from || data.remoteJid || data.phone || "";
      const messageText = data.body || data.text || data.message?.conversation || 
                          data.message?.extendedTextMessage?.text || "";
      const messageId = data.id || data.key?.id || payload.id || "";
      const mediaUrl = data.mediaUrl || data.message?.imageMessage?.url || 
                       data.message?.documentMessage?.url || null;
      const mediaType = data.mediaType || 
                        (data.message?.imageMessage ? "image" : null) ||
                        (data.message?.documentMessage ? "document" : null) ||
                        (data.message?.audioMessage ? "audio" : null);

      const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");
      
      if (!cleanPhone || !messageText) {
        console.log("Missing phone or message, skipping");
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // IDEMPOTENCY: Check if message already exists by wapi_message_id
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("wapi_message_id", messageId)
          .limit(1)
          .single();

        if (existingMsg) {
          console.log(`Message ${messageId} already exists, skipping (idempotency)`);
          return new Response(JSON.stringify({ success: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Find guardian by phone
      const phoneVariants = [
        cleanPhone,
        cleanPhone.startsWith("55") ? cleanPhone.slice(2) : `55${cleanPhone}`,
      ];

      let guardianId: string | null = null;

      for (const phoneVariant of phoneVariants) {
        const { data: guardian } = await supabase
          .from("guardians")
          .select("id")
          .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}`)
          .limit(1)
          .single();

        if (guardian) {
          guardianId = guardian.id;
          break;
        }
      }

      // Store the incoming message
      const { error: insertError } = await supabase
        .from("whatsapp_messages")
        .insert({
          guardian_id: guardianId,
          phone: cleanPhone,
          message: messageText,
          direction: "incoming",
          status: "received",
          wapi_message_id: messageId || null,
          media_url: mediaUrl,
          media_type: mediaType,
        });

      if (insertError) {
        console.error("Error inserting message:", insertError);
        throw insertError;
      }

      console.log(`Message stored from ${cleanPhone}, guardian: ${guardianId || "unknown"}, time: ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({ success: true, guardianId, phone: cleanPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Handle MESSAGE SENT (outgoing messages from WhatsApp) ======
    if (event === "message-sent" || event === "messages.update" || data.fromMe === true) {
      const phone = data.to || data.remoteJid || data.phone || "";
      const messageText = data.body || data.text || data.message?.conversation || "";
      const messageId = data.id || data.key?.id || "";
      
      const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");

      if (messageId && cleanPhone) {
        // Check if this outgoing message was sent from our system (already in DB)
        const { data: existingMsg } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("wapi_message_id", messageId)
          .limit(1)
          .single();

        if (!existingMsg && messageText) {
          // Message sent directly from phone, not from our system - record it
          await supabase.from("whatsapp_messages").insert({
            phone: cleanPhone,
            message: messageText,
            direction: "outgoing",
            status: "sent",
            wapi_message_id: messageId,
          });
          console.log(`Outgoing message from phone recorded: ${cleanPhone}`);
        }
      }

      return new Response(JSON.stringify({ success: true, event: "message-sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== Handle MESSAGE STATUS UPDATES (delivered, read, failed) ======
    if (event === "message-status" || event === "messages.status" || event === "ack") {
      const messageId = data.id || data.key?.id || payload.messageId || "";
      const status = data.status || data.ack || payload.status;

      // Map W-API status codes to our status
      const statusMap: Record<string | number, string> = {
        "1": "sent",
        "2": "delivered", 
        "3": "read",
        "4": "played", // for audio
        "-1": "failed",
        "error": "failed",
        "sent": "sent",
        "delivered": "delivered",
        "read": "read",
        "played": "played",
        "failed": "failed",
      };

      const mappedStatus = statusMap[status] || "sent";

      if (messageId) {
        const { error: updateError } = await supabase
          .from("whatsapp_messages")
          .update({ status: mappedStatus })
          .eq("wapi_message_id", messageId);

        if (updateError) {
          console.error("Error updating message status:", updateError);
        } else {
          console.log(`Message ${messageId} status updated to: ${mappedStatus}`);
        }
      }

      return new Response(JSON.stringify({ success: true, event: "status-update", status: mappedStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== Handle CONNECTION STATUS ======
    if (event === "connection-status" || event === "connection.update" || event === "qr") {
      const connectionState = data.state || data.connection || payload.status;
      console.log(`Connection status: ${connectionState}`);

      // Could store connection status in app_settings or a dedicated table
      // For now, just log it
      return new Response(JSON.stringify({ success: true, event: "connection", state: connectionState }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For unknown events, just acknowledge
    console.log(`Unknown event type: ${event}, acknowledging`);
    return new Response(JSON.stringify({ success: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Still return 200 to prevent webhook retries for processing errors
    return new Response(
      JSON.stringify({ error: errorMessage, acknowledged: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
