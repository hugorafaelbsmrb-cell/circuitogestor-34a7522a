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

    // W-API PRO sends different event types
    const event = payload.event || payload.type || "unknown";
    const data = payload.data || payload.message || payload;

    // Check if this is a W-API PRO "webhookReceived" message event
    const isProMessageEvent = event === "webhookReceived" && payload.msgContent && payload.sender;
    const isIncomingMessage = event === "message" || event === "messages.upsert" || event === "message-received" || 
        isProMessageEvent || (data.fromMe === false && data.body);

    // ====== Handle BUTTON/LIST RESPONSE ======
    const isButtonResponse = event === "button_response" || data.selectedButtonId || data.buttonReply;
    const isListResponse = event === "list_response" || data.selectedRowId || data.listReply;

    if (isButtonResponse || isListResponse) {
      const phone = data.from || data.remoteJid || data.phone || payload.sender?.id || "";
      const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");
      
      let responseText = "";
      if (isButtonResponse) {
        responseText = data.selectedButtonText || data.buttonReply?.displayText || data.body || "[Botão selecionado]";
      } else {
        responseText = data.selectedRowTitle || data.listReply?.title || data.body || "[Opção selecionada]";
      }

      const messageId = data.id || data.key?.id || payload.messageId || "";

      // Check for duplicate
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("wapi_message_id", messageId)
          .limit(1)
          .single();

        if (existingMsg) {
          return new Response(JSON.stringify({ success: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Find guardian using flexible phone matching
      let guardianId: string | null = null;
      
      // Generate phone variants for matching (handles 9-digit mobile prefix variations)
      const basePhone = cleanPhone.replace(/^55/, ""); // Remove country code
      const phoneWithNine = basePhone.length === 10 ? basePhone.slice(0, 2) + "9" + basePhone.slice(2) : basePhone;
      const phoneWithoutNine = basePhone.length === 11 && basePhone[2] === "9" ? basePhone.slice(0, 2) + basePhone.slice(3) : basePhone;
      
      const phoneVariants = [
        cleanPhone,
        `55${phoneWithNine}`,
        `55${phoneWithoutNine}`,
        phoneWithNine,
        phoneWithoutNine,
      ];
      
      // Try to find guardian with any variant, also use last 8 digits for flexible matching
      const last8 = cleanPhone.slice(-8);
      
      for (const phoneVariant of phoneVariants) {
        const { data: guardian } = await supabase
          .from("guardians")
          .select("id")
          .or(`phone.eq.${phoneVariant},phone.ilike.%${last8}`)
          .limit(1)
          .single();

        if (guardian) {
          guardianId = guardian.id;
          break;
        }
      }

      // Store the response
      await supabase.from("whatsapp_messages").insert({
        guardian_id: guardianId,
        phone: cleanPhone,
        message: responseText,
        direction: "incoming",
        status: "received",
        wapi_message_id: messageId || null,
        media_type: isButtonResponse ? "button_response" : "list_response",
      });

      console.log(`${isButtonResponse ? "Button" : "List"} response stored from ${cleanPhone}`);

      return new Response(
        JSON.stringify({ success: true, type: isButtonResponse ? "button_response" : "list_response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Handle MESSAGE RECEIVED ======
    if (isIncomingMessage && payload.fromMe !== true) {
      
      // Handle W-API PRO format (webhookReceived)
      let phone = "";
      let messageText = "";
      let messageId = "";
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (isProMessageEvent) {
        // W-API PRO format
        phone = payload.sender?.id || payload.chat?.id || "";
        messageText = payload.msgContent?.conversation || 
                      payload.msgContent?.extendedTextMessage?.text ||
                      payload.msgContent?.text || "";
        messageId = payload.messageId || "";
        
        // Handle media in PRO format
        if (payload.msgContent?.imageMessage) {
          mediaType = "image";
          mediaUrl = payload.msgContent.imageMessage.url || null;
        } else if (payload.msgContent?.documentMessage) {
          mediaType = "document";
          mediaUrl = payload.msgContent.documentMessage.url || null;
        } else if (payload.msgContent?.audioMessage) {
          mediaType = "audio";
          mediaUrl = payload.msgContent.audioMessage.url || null;
        }
      } else {
        // Standard format
        phone = data.from || data.remoteJid || data.phone || "";
        messageText = data.body || data.text || data.message?.conversation || 
                      data.message?.extendedTextMessage?.text || "";
        messageId = data.id || data.key?.id || payload.id || "";
        mediaUrl = data.mediaUrl || data.message?.imageMessage?.url || 
                   data.message?.documentMessage?.url || null;
        mediaType = data.mediaType || 
                    (data.message?.imageMessage ? "image" : null) ||
                    (data.message?.documentMessage ? "document" : null) ||
                    (data.message?.audioMessage ? "audio" : null);
      }

      const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");
      
      if (!cleanPhone || !messageText) {
        console.log("Missing phone or message, skipping. Phone:", cleanPhone, "Message:", messageText);
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

      // Find guardian using flexible phone matching (handles 9-digit mobile prefix variations)
      const basePhone = cleanPhone.replace(/^55/, ""); // Remove country code
      const phoneWithNine = basePhone.length === 10 ? basePhone.slice(0, 2) + "9" + basePhone.slice(2) : basePhone;
      const phoneWithoutNine = basePhone.length === 11 && basePhone[2] === "9" ? basePhone.slice(0, 2) + basePhone.slice(3) : basePhone;
      
      const phoneVariants = [
        cleanPhone,
        `55${phoneWithNine}`,
        `55${phoneWithoutNine}`,
        phoneWithNine,
        phoneWithoutNine,
      ];

      let guardianId: string | null = null;
      
      // Try to find guardian with any variant, also use last 8 digits for flexible matching
      const last8 = cleanPhone.slice(-8);

      for (const phoneVariant of phoneVariants) {
        const { data: guardian } = await supabase
          .from("guardians")
          .select("id")
          .or(`phone.eq.${phoneVariant},phone.ilike.%${last8}`)
          .limit(1)
          .single();

        if (guardian) {
          guardianId = guardian.id;
          break;
        }
      }

      // Store the incoming message
      const { data: insertedMessage, error: insertError } = await supabase
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
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("Error inserting message:", insertError);
        throw insertError;
      }

      console.log(`Message stored from ${cleanPhone}, guardian: ${guardianId || "unknown"}, time: ${Date.now() - startTime}ms`);

      // Trigger homework report processing for Reforço Escolar students
      // Do this asynchronously to not delay the webhook response
      if (guardianId && messageText) {
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-homework-report`;
        
        // Fire and forget - don't await
        fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messageId: insertedMessage?.id,
            guardianId,
            phone: cleanPhone,
            message: messageText,
          }),
        }).then(res => {
          console.log(`Homework report processing triggered, status: ${res.status}`);
        }).catch(err => {
          console.error("Error triggering homework report processing:", err);
        });
      }

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
