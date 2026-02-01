import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get W-API configuration from app_settings
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
          error: "W-API not configured",
          contacts: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body for pagination
    let page = 1;
    let perPage = 100;
    try {
      const body = await req.json();
      page = body.page || 1;
      perPage = body.perPage || 100;
    } catch {
      // Use defaults
    }

    // Fetch contacts from W-API
    const contactsUrl = `${baseUrl}/v1/contacts/fetch-contacts?instanceId=${instanceId}&perPage=${perPage}&page=${page}`;
    
    console.log(`Fetching contacts from: ${contactsUrl}`);
    
    const response = await fetch(contactsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`W-API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `W-API returned ${response.status}`,
          contacts: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // W-API returns contacts in various formats, normalize them
    let contacts: Array<{
      phone: string;
      name: string | null;
      pushName: string | null;
      profilePicUrl: string | null;
    }> = [];

    if (Array.isArray(data)) {
      contacts = data.map((c: any) => ({
        phone: c.id?.replace("@c.us", "") || c.phone || c.number || "",
        name: c.name || c.verifiedName || null,
        pushName: c.pushName || c.notify || c.pushname || null,
        profilePicUrl: c.profilePicUrl || c.imgUrl || null,
      }));
    } else if (data?.contacts && Array.isArray(data.contacts)) {
      contacts = data.contacts.map((c: any) => ({
        phone: c.id?.replace("@c.us", "") || c.phone || c.number || "",
        name: c.name || c.verifiedName || null,
        pushName: c.pushName || c.notify || c.pushname || null,
        profilePicUrl: c.profilePicUrl || c.imgUrl || null,
      }));
    } else if (data?.data && Array.isArray(data.data)) {
      contacts = data.data.map((c: any) => ({
        phone: c.id?.replace("@c.us", "") || c.phone || c.number || "",
        name: c.name || c.verifiedName || null,
        pushName: c.pushName || c.notify || c.pushname || null,
        profilePicUrl: c.profilePicUrl || c.imgUrl || null,
      }));
    }

    // Filter out invalid phones
    contacts = contacts.filter((c) => c.phone && c.phone.length >= 10);

    console.log(`Fetched ${contacts.length} contacts from W-API`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contacts,
        total: contacts.length,
        page,
        perPage 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching contacts:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        contacts: [] 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
