import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("W-API Webhook received:", JSON.stringify(payload, null, 2));

    // W-API sends different event types
    // Common structure: { event: 'message', data: { ... } }
    const event = payload.event || payload.type;
    const data = payload.data || payload.message || payload;

    if (event === "message" || event === "messages.upsert" || data.fromMe === false) {
      // Extract message details from W-API payload
      // W-API formats can vary, so we handle multiple structures
      const phone = data.from || data.remoteJid || data.phone || "";
      const messageText = data.body || data.text || data.message?.conversation || 
                          data.message?.extendedTextMessage?.text || "";
      const messageId = data.id || data.key?.id || "";
      const mediaUrl = data.mediaUrl || data.message?.imageMessage?.url || 
                       data.message?.documentMessage?.url || null;
      const mediaType = data.mediaType || 
                        (data.message?.imageMessage ? "image" : null) ||
                        (data.message?.documentMessage ? "document" : null) ||
                        (data.message?.audioMessage ? "audio" : null);

      // Clean phone number (remove @s.whatsapp.net suffix if present)
      const cleanPhone = phone.replace(/@.*$/, "").replace(/\D/g, "");
      
      if (!cleanPhone || !messageText) {
        console.log("Missing phone or message, skipping");
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to find guardian by phone (with or without country code)
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
          wapi_message_id: messageId,
          media_url: mediaUrl,
          media_type: mediaType,
        });

      if (insertError) {
        console.error("Error inserting message:", insertError);
        throw insertError;
      }

      console.log(`Message stored from ${cleanPhone}, guardian: ${guardianId || "unknown"}`);

      return new Response(
        JSON.stringify({ success: true, guardianId, phone: cleanPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For other events (status updates, etc.), just acknowledge
    return new Response(JSON.stringify({ success: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
