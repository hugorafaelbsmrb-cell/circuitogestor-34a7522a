// Proxy upload to external photo hosting API (Circuito Kids / hospedagemcpanel)
// Receives base64 image + metadata from admin, uploads to external API, returns public URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getSetting(sb: any, key: string): Promise<string> {
  const { data } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value || "").trim();
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function login(baseUrl: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${baseUrl}/auth.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const txt = await r.text();
    try {
      const j = JSON.parse(txt);
      return j.token || j.jwt || j.access_token || null;
    } catch { return null; }
  } catch { return null; }
}

async function tryUpload(baseUrl: string, headers: Record<string, string>, file: Uint8Array, fileName: string, contentType: string) {
  const fd = new FormData();
  fd.append("file", new Blob([file], { type: contentType }), fileName);
  const r = await fetch(`${baseUrl}/upload.php`, { method: "POST", headers, body: fd });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, text, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userSb = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userSb.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (userErr || !userId) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await sbAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { fileName, base64, contentType, campId, dayLabel, activityTag, scheduleId, hasWatermark, hasFrame, width, height } = body || {};
    if (!fileName || !base64 || !contentType || !campId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = (await getSetting(sbAdmin, "PHOTO_API_URL")) || "https://api.circuitokids.com.br";
    const apiKey = await getSetting(sbAdmin, "PHOTO_API_KEY");
    const companySlug = await getSetting(sbAdmin, "PHOTO_API_COMPANY_SLUG");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "PHOTO_API_KEY não configurada nas Configurações" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fileBytes = b64ToBytes(base64);

    // Attempt 1: API Key directly via X-API-Key header
    let attempt = await tryUpload(baseUrl, { "X-API-Key": apiKey }, fileBytes, fileName, contentType);

    // Attempt 2: Bearer with raw key
    if (!attempt.ok) {
      attempt = await tryUpload(baseUrl, { Authorization: `Bearer ${apiKey}` }, fileBytes, fileName, contentType);
    }

    // Attempt 3: Login flow → JWT → upload
    if (!attempt.ok) {
      const token = await login(baseUrl, apiKey);
      if (token) {
        attempt = await tryUpload(baseUrl, { Authorization: `Bearer ${token}` }, fileBytes, fileName, contentType);
      }
    }

    if (!attempt.ok) {
      return new Response(JSON.stringify({ error: "Upload failed", status: attempt.status, detail: attempt.text?.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const j = attempt.json || {};
    const externalUrl: string = j.url || j.public_url || j.file?.url || (j.path && `${baseUrl}/${j.path}`) || "";
    const externalPath: string = j.path || j.file?.path || j.name || fileName;
    if (!externalUrl) {
      return new Response(JSON.stringify({ error: "Upload sem URL retornada", raw: attempt.json }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: photo, error: dbError } = await sbAdmin.from("vacation_camp_photos").insert({
      camp_id: campId,
      external_url: externalUrl,
      external_path: externalPath,
      day_label: dayLabel || null,
      activity_tag: activityTag || null,
      schedule_id: scheduleId || null,
      has_watermark: !!hasWatermark,
      has_frame: !!hasFrame,
      width: width || null,
      height: height || null,
    }).select().single();

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ photo, externalUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
