// Delete a photo from external API and local DB
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getSetting(sb: any, key: string): Promise<string> {
  const { data } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userSb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await userSb.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (userErr || !userId) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await sbAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { photoId } = await req.json();
    if (!photoId) return new Response(JSON.stringify({ error: "Missing photoId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: photo } = await sbAdmin.from("vacation_camp_photos").select("*").eq("id", photoId).maybeSingle();
    if (!photo) return new Response(JSON.stringify({ error: "Photo not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Best-effort delete on external API
    try {
      const baseUrl = (await getSetting(sbAdmin, "PHOTO_API_URL")) || "https://api.circuitokids.com.br";
      const apiKey = await getSetting(sbAdmin, "PHOTO_API_KEY");
      if (apiKey && photo.external_path) {
        const candidates = [
          { method: "DELETE", url: `${baseUrl}/upload.php?path=${encodeURIComponent(photo.external_path)}`, headers: { "X-API-Key": apiKey } as Record<string, string> },
          { method: "DELETE", url: `${baseUrl}/crud.php?path=${encodeURIComponent(photo.external_path)}`, headers: { Authorization: `Bearer ${apiKey}` } as Record<string, string> },
        ];
        for (const c of candidates) {
          try {
            const r = await fetch(c.url, { method: c.method, headers: c.headers });
            if (r.ok) break;
          } catch {}
        }
      }
    } catch {}

    await sbAdmin.from("vacation_camp_photos").delete().eq("id", photoId);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
