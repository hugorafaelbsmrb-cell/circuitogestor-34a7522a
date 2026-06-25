import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const today = new Date();
    // UTC-3 today
    const brt = new Date(today.getTime() - 3 * 3600 * 1000);
    const todayStr = brt.toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("vacation_camp_enrollments")
      .select("id, guardian_phone, reserved_payment_date")
      .eq("payment_status", "reserved")
      .is("reservation_sent_at", null)
      .lte("reserved_payment_date", todayStr);
    if (error) throw error;

    const results: any[] = [];
    for (const row of rows || []) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/vacation-camp-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            apikey: SERVICE_ROLE,
          },
          body: JSON.stringify({ event: "payment_link", enrollment_id: row.id }),
        });
        const ok = resp.ok;
        if (ok) {
          await supabase
            .from("vacation_camp_enrollments")
            .update({ reservation_sent_at: new Date().toISOString() })
            .eq("id", row.id);
        }
        results.push({ id: row.id, sent: ok });
      } catch (e) {
        results.push({ id: row.id, sent: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
