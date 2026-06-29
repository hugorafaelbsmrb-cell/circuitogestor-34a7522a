// Public photo upload (no auth) for vacation camp album.
// Requires camp slug + camp must have public_uploads_enabled = true.
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

async function login(baseUrl: string, apiKey: string): Promise<{ token: string | null; detail: string }> {
  try {
    const r = await fetch(`${baseUrl}/auth.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login_api_key", api_key: apiKey }),
    });
    const txt = await r.text();
    try { const j = JSON.parse(txt); return { token: j.token || j.jwt || j.access_token || null, detail: txt.slice(0, 300) }; }
    catch { return { token: null, detail: txt.slice(0, 300) }; }
  } catch (e) { return { token: null, detail: String(e) }; }
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
    const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { campSlug, fileName, base64, contentType, dayLabel, activityTag, uploaderName, uploaderPhone, hasWatermark, hasFrame, width, height } = body || {};
    if (!campSlug || !fileName || !base64 || !contentType) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!uploaderName || String(uploaderName).trim().length < 2) {
      return new Response(JSON.stringify({ error: "Informe seu nome" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: camp } = await sbAdmin.from("vacation_camps").select("id, slug, public_uploads_enabled, album_enabled").eq("slug", campSlug).maybeSingle();
    if (!camp) return new Response(JSON.stringify({ error: "Colônia não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!camp.public_uploads_enabled) {
      return new Response(JSON.stringify({ error: "Upload público desativado para esta colônia" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Basic rate limit per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const { data: rlOk } = await sbAdmin.rpc("check_rate_limit", { p_identifier: ip, p_endpoint: "vacation-camp-photo-upload-public", p_max_requests: 60, p_window_minutes: 5 });
    if (rlOk === false) {
      return new Response(JSON.stringify({ error: "Muitos envios. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = (await getSetting(sbAdmin, "PHOTO_API_URL")) || "https://api.circuitokids.com.br";
    const apiKey = await getSetting(sbAdmin, "PHOTO_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "API de fotos não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const fileBytes = b64ToBytes(base64);
    let attempt = await tryUpload(baseUrl, { "X-API-Key": apiKey }, fileBytes, fileName, contentType);
    if (!attempt.ok) attempt = await tryUpload(baseUrl, { Authorization: `Bearer ${apiKey}` }, fileBytes, fileName, contentType);
    if (!attempt.ok) {
      const token = await login(baseUrl, apiKey);
      if (token) attempt = await tryUpload(baseUrl, { Authorization: `Bearer ${token}` }, fileBytes, fileName, contentType);
    }
    if (!attempt.ok) {
      return new Response(JSON.stringify({ error: "Falha no upload externo", status: attempt.status, detail: attempt.text?.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = attempt.json || {};
    const externalUrl: string = j.url || j.public_url || j.file?.url || (j.path && `${baseUrl}/${j.path}`) || "";
    const externalPath: string = j.path || j.file?.path || j.name || fileName;
    if (!externalUrl) {
      return new Response(JSON.stringify({ error: "Upload sem URL", raw: attempt.json }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: photo, error: dbError } = await sbAdmin.from("vacation_camp_photos").insert({
      camp_id: camp.id,
      external_url: externalUrl,
      external_path: externalPath,
      day_label: dayLabel || null,
      activity_tag: activityTag || null,
      has_watermark: !!hasWatermark,
      has_frame: !!hasFrame,
      width: width || null,
      height: height || null,
      uploader_name: String(uploaderName).trim(),
      uploader_phone: uploaderPhone ? String(uploaderPhone).trim() : null,
      source: "public",
    }).select().single();

    if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ photo, externalUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
