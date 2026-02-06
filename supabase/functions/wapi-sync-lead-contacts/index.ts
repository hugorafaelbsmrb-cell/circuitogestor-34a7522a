import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get W-API configuration
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["W_API_SESSION", "W_API_TOKEN", "W_API_URL"]);

    if (settingsError) throw settingsError;

    const getSettingValue = (key: string) =>
      settings?.find((s) => s.key === key)?.value || null;

    const instanceId = getSettingValue("W_API_SESSION");
    const token = getSettingValue("W_API_TOKEN");
    const baseUrl = getSettingValue("W_API_URL") || "https://api.w-api.app";

    if (!instanceId || !token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "W-API not configured" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body for optional filters
    let leadIds: string[] | null = null;
    let limit = 50;
    try {
      const body = await req.json();
      leadIds = body.leadIds || null;
      limit = body.limit || 50;
    } catch {
      // Use defaults
    }

    // Fetch leads without avatar_url
    let query = supabase
      .from("leads")
      .select("id, phone, name, avatar_url")
      .is("avatar_url", null)
      .limit(limit);

    if (leadIds && leadIds.length > 0) {
      query = supabase
        .from("leads")
        .select("id, phone, name, avatar_url")
        .in("id", leadIds);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No leads to update",
          updated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${leads.length} leads for profile picture sync`);

    let updatedCount = 0;
    const errors: Array<{ leadId: string; phone: string; error: string }> = [];

    for (const lead of leads) {
      try {
        // Format phone for W-API (should be in format like 5511999999999)
        const cleanPhone = lead.phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        
        // Use the profile-picture endpoint that works
        const profilePicUrl = `${baseUrl}/v1/contacts/profile-picture?instanceId=${encodeURIComponent(instanceId)}&phoneNumber=${formattedPhone}`;
        
        console.log(`Fetching profile picture for ${formattedPhone}`);
        
        const response = await fetch(profilePicUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`W-API error for ${formattedPhone}: ${response.status} - ${errorText.slice(0, 200)}`);
          // Not a critical error - contact may not have a picture or WhatsApp
          continue;
        }

        const data = await response.json();
        
        // Extract profile picture URL from response (W-API returns in different formats)
        const profilePictureUrl = data.link || 
                                  data.profilePictureUrl || 
                                  data.profilePicThumbObj?.img || 
                                  data.url || 
                                  data.imgUrl ||
                                  data.result?.profilePictureUrl ||
                                  data.result?.url ||
                                  null;

        // Only update if we got a profile picture
        if (profilePictureUrl) {
          const { error: updateError } = await supabase
            .from("leads")
            .update({ 
              avatar_url: profilePictureUrl,
              updated_at: new Date().toISOString()
            })
            .eq("id", lead.id);

          if (updateError) {
            console.error(`Error updating lead ${lead.id}:`, updateError);
            errors.push({ leadId: lead.id, phone: formattedPhone, error: updateError.message });
          } else {
            updatedCount++;
            console.log(`Updated lead ${lead.id} with profile picture`);
          }
        } else {
          console.log(`No profile picture found for ${formattedPhone}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing lead ${lead.id}:`, error);
        errors.push({ leadId: lead.id, phone: lead.phone, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: leads.length,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing lead contacts:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
