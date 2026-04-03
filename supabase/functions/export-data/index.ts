import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Helper: run raw SQL via PostgREST rpc or direct pg
    const runSql = async (sql: string) => {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      return null;
    };

    // 1. Export all public tables
    const knownTables = [
      "app_settings", "asset_categories", "attendance_records", "audit_logs",
      "automation_settings", "bulk_message_templates", "campaign_images",
      "canteen_consumptions", "canteen_products", "canteen_weekly_summaries",
      "carnes", "class_groups", "contract_clauses", "contract_config",
      "contract_signature_logs", "contracts", "course_landing_pages", "courses",
      "discounts", "email_messages", "enrollment_schedules", "enrollments",
      "fixed_assets", "guardian_support_tickets", "guardians", "homework_reports",
      "iot_devices", "iot_schedules", "leads", "lms_credentials", "message_logs",
      "payments", "profiles", "quick_reply_templates", "rate_limits",
      "report_parent_comments", "scheduled_bulk_messages", "schedules",
      "soroban_credentials", "student_reports", "students", "teacher_credentials",
      "teacher_training_progress", "teachers", "user_roles", "whatsapp_messages"
    ];

    const tables: Record<string, any> = {};
    for (const table of knownTables) {
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(`Error fetching ${table}:`, error.message);
          tables[table] = { error: error.message };
          hasMore = false;
        } else {
          allRows.push(...(data || []));
          hasMore = (data?.length || 0) === pageSize;
          from += pageSize;
        }
      }

      if (!tables[table] || !('error' in tables[table])) {
        tables[table] = allRows;
      }
    }

    // 2. RLS Policies via pg_policies
    let rls_policies: Record<string, any[]> = {};
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_rls_policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        const policies = await resp.json();
        for (const p of policies) {
          const tbl = p.tablename;
          if (!rls_policies[tbl]) rls_policies[tbl] = [];
          rls_policies[tbl].push(p);
        }
      }
    } catch {
      rls_policies = { _note: "Could not export RLS policies. Use pg_dump." } as any;
    }

    // 3. Database functions
    let functions: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_db_functions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        functions = await resp.json();
      }
    } catch {
      functions = [{ _note: "Could not export functions. Use pg_dump." }];
    }

    // 4. Triggers
    let triggers: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_triggers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        triggers = await resp.json();
      }
    } catch {
      triggers = [{ _note: "Could not export triggers. Use pg_dump." }];
    }

    // 5. Cron jobs
    let cron_jobs: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_cron_jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        cron_jobs = await resp.json();
      }
    } catch {
      cron_jobs = [{ _note: "pg_cron not available or no jobs." }];
    }

    // 6. Auth users
    let auth_users: any[] = [];
    try {
      const perPage = 1000;
      let page = 1;
      let hasMoreUsers = true;

      while (hasMoreUsers) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          console.error("Error fetching auth users:", error.message);
          hasMoreUsers = false;
        } else {
          const mapped = (users || []).map((u: any) => ({
            id: u.id,
            email: u.email,
            encrypted_password: u.encrypted_password,
            aud: u.aud,
            role: u.role,
            phone: u.phone,
            created_at: u.created_at,
            email_confirmed_at: u.email_confirmed_at,
            raw_user_meta_data: u.user_metadata,
            raw_app_meta_data: u.app_metadata,
          }));
          auth_users.push(...mapped);
          hasMoreUsers = (users?.length || 0) === perPage;
          page++;
        }
      }
    } catch (e) {
      auth_users = [{ error: `Could not export auth users: ${e}` }];
    }

    // 7. Auth identities
    let auth_identities: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_auth_identities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        auth_identities = await resp.json();
      }
    } catch {
      auth_identities = [{ _note: "Could not export auth identities." }];
    }

    // 8. Storage buckets
    let storage_buckets: any[] = [];
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      for (const bucket of (buckets || [])) {
        const { data: files } = await supabase.storage.from(bucket.name).list("", {
          limit: 10000,
        });
        storage_buckets.push({
          name: bucket.name,
          public: bucket.public,
          created_at: bucket.created_at,
          files: (files || []).map((f: any) => ({
            name: f.name,
            size: f.metadata?.size,
            mimetype: f.metadata?.mimetype,
            created_at: f.created_at,
          })),
        });
      }
    } catch (e) {
      storage_buckets = [{ error: `Could not export storage: ${e}` }];
    }

    // 9. Enums
    let enums: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_enums`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        enums = await resp.json();
      }
    } catch {
      enums = [{ app_role: ["admin", "moderator", "user"], _note: "Fallback enum list" }];
    }

    const result = {
      _export_date: new Date().toISOString(),
      _warning: "TEMPORARY EXPORT - DELETE THIS FUNCTION IMMEDIATELY AFTER USE",
      tables,
      rls_policies,
      functions,
      triggers,
      cron_jobs,
      auth_users,
      auth_identities,
      storage_buckets,
      enums,
      jwt_secret: jwtSecret,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
