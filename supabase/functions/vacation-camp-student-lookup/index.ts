import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cpf, camp_slug } = await req.json();
    if (!cpf || !isValidCPF(String(cpf))) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = String(cpf).replace(/\D/g, "");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Rate limit por CPF
    try {
      const { data: ok } = await supabase.rpc("check_rate_limit", {
        p_identifier: cleanCpf,
        p_endpoint: "vacation-camp-student-lookup",
        p_max_requests: 10,
        p_window_minutes: 5,
      });
      if (ok === false) {
        return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_e) { /* ignore */ }

    // Busca guardian pelo CPF
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id, name, phone, email")
      .eq("cpf", cleanCpf)
      .maybeSingle();

    if (!guardian) {
      return new Response(JSON.stringify({ found: false, students: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca alunos ativos vinculados
    const { data: students } = await supabase
      .from("students")
      .select("id, name, birth_date, is_active")
      .eq("guardian_id", guardian.id)
      .eq("is_active", true);

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ found: true, guardian: { name: guardian.name }, students: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Para cada aluno, computa base_tuition (maior valor entre últimas parcelas pagas)
    const result: Array<{ id: string; name: string; birth_date: string | null; base_tuition: number | null }> = [];
    for (const st of students) {
      // Matrículas ativas do aluno
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("student_id", st.id)
        .eq("status", "active");

      let baseTuition: number | null = null;
      if (enrolls && enrolls.length > 0) {
        const ids = enrolls.map((e: any) => e.id);
        const { data: pays } = await supabase
          .from("payments")
          .select("value, status, payment_date, due_date, enrollment_id")
          .in("enrollment_id", ids)
          .in("status", ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])
          .order("payment_date", { ascending: false })
          .limit(50);

        if (pays && pays.length > 0) {
          // Maior valor entre últimas pagas
          baseTuition = Math.max(...pays.map((p: any) => Number(p.value) || 0));
        } else {
          // Fallback: maior preço do curso
          const { data: cgs } = await supabase
            .from("enrollments")
            .select("class_group_id")
            .in("id", ids);
          const cgIds = (cgs || []).map((x: any) => x.class_group_id).filter(Boolean);
          if (cgIds.length > 0) {
            const { data: groups } = await supabase
              .from("class_groups")
              .select("course_id")
              .in("id", cgIds);
            const courseIds = (groups || []).map((g: any) => g.course_id).filter(Boolean);
            if (courseIds.length > 0) {
              const { data: courses } = await supabase
                .from("courses")
                .select("price")
                .in("id", courseIds);
              if (courses && courses.length > 0) {
                baseTuition = Math.max(...courses.map((c: any) => Number(c.price) || 0));
              }
            }
          }
        }
      }

      result.push({
        id: st.id,
        name: st.name,
        birth_date: st.birth_date,
        base_tuition: baseTuition,
      });
    }

    return new Response(
      JSON.stringify({
        found: true,
        guardian: { name: guardian.name, phone: guardian.phone, email: guardian.email },
        students: result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("student-lookup error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
