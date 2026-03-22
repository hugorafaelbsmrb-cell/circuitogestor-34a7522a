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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Get all public tables
    const { data: tableList } = await supabase.rpc("export_get_tables").select();
    
    // Fallback: query pg_tables directly via SQL in an RPC or use known tables
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

    // Export all table data
    const tables: Record<string, any[]> = {};
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
          tables[table] = { error: error.message } as any;
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
      const { data: policies } = await supabase
        .from("pg_policies" as any)
        .select("*");
      
      // If direct access fails, we'll use a different approach
      if (policies) {
        for (const p of policies) {
          const tbl = p.tablename;
          if (!rls_policies[tbl]) rls_policies[tbl] = [];
          rls_policies[tbl].push(p);
        }
      }
    } catch {
      rls_policies = { _note: "Could not export RLS policies directly. Use pg_dump for full export." } as any;
    }

    // 3. Auth users
    let auth_users: any[] = [];
    try {
      // Use admin API to list users
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
          }));
          auth_users.push(...mapped);
          hasMoreUsers = (users?.length || 0) === perPage;
          page++;
        }
      }
    } catch (e) {
      auth_users = [{ error: `Could not export auth users: ${e}` }];
    }

    // 4. Storage buckets and files
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

    // 5. Database functions, triggers, enums via direct SQL (using supabase-js rpc won't work for pg_catalog)
    // We'll document what we can't get directly
    const metadata_note = "For full export of functions, triggers, enums, RLS policies, and cron jobs, use: pg_dump --schema=public --no-owner --no-privileges";

    const result = {
      _export_date: new Date().toISOString(),
      _warning: "TEMPORARY EXPORT - DELETE THIS FUNCTION IMMEDIATELY AFTER USE",
      _metadata_note: metadata_note,
      tables,
      rls_policies,
      functions: { _note: "Use pg_dump for complete function definitions. Known functions: update_updated_at_column, is_admin_secure, check_rate_limit, log_audit, cleanup_rate_limits, handle_new_user, has_role, handle_new_user_role, is_admin" },
      triggers: { _note: "Use pg_dump for trigger definitions" },
      cron_jobs: { _note: "Check cron.job table if pg_cron is enabled" },
      auth_users,
      storage_buckets,
      enums: { 
        app_role: ["admin", "moderator", "user"],
        _note: "Known enum types in public schema"
      },
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
