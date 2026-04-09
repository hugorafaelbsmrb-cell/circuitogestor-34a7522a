import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || null;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
        const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
        if (error) {
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

    // 2. RLS Policies
    let rls_policies: Record<string, any[]> = {};
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_rls_policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
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
    } catch { rls_policies = { _note: "Could not export" } as any; }

    // 3. Functions
    let functions: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_db_functions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      if (resp.ok) functions = await resp.json();
    } catch { functions = []; }

    // 4. Triggers
    let triggers: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      if (resp.ok) triggers = await resp.json();
    } catch { triggers = []; }

    // 5. Cron jobs
    let cron_jobs: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_cron_jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      if (resp.ok) cron_jobs = await resp.json();
    } catch { cron_jobs = []; }

    // 6. Auth users
    let auth_users: any[] = [];
    try {
      let page = 1;
      let hasMoreUsers = true;
      while (hasMoreUsers) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) { hasMoreUsers = false; } else {
          auth_users.push(...(users || []).map((u: any) => ({
            id: u.id, email: u.email, encrypted_password: u.encrypted_password,
            aud: u.aud, role: u.role, phone: u.phone, created_at: u.created_at,
            email_confirmed_at: u.email_confirmed_at,
            raw_user_meta_data: u.user_metadata, raw_app_meta_data: u.app_metadata,
          })));
          hasMoreUsers = (users?.length || 0) === 1000;
          page++;
        }
      }
    } catch (e) { auth_users = [{ error: `${e}` }]; }

    // 7. Auth identities
    let auth_identities: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_auth_identities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      if (resp.ok) auth_identities = await resp.json();
    } catch { auth_identities = []; }

    // 8. Storage with base64 content
    let storage_buckets: any[] = [];
    let totalFiles = 0, embeddedFiles = 0, skippedLargeFiles = 0;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      for (const bucket of (buckets || [])) {
        const { data: files } = await supabase.storage.from(bucket.name).list("", { limit: 10000 });
        const fileEntries: any[] = [];

        for (const f of (files || [])) {
          if (f.id === null && !f.name) continue; // skip folders
          totalFiles++;
          const fileSize = f.metadata?.size || 0;
          const entry: any = {
            name: f.name,
            size: fileSize,
            mimetype: f.metadata?.mimetype,
            created_at: f.created_at,
          };

          if (fileSize > 0 && fileSize <= MAX_FILE_SIZE) {
            try {
              const { data: blob, error } = await supabase.storage.from(bucket.name).download(f.name);
              if (!error && blob) {
                const arrayBuffer = await blob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                entry.content_base64 = uint8ToBase64(bytes);
                embeddedFiles++;
              }
            } catch { /* skip */ }
          } else if (fileSize > MAX_FILE_SIZE) {
            skippedLargeFiles++;
          }

          fileEntries.push(entry);
        }

        storage_buckets.push({
          name: bucket.name,
          public: bucket.public,
          created_at: bucket.created_at,
          files: fileEntries,
        });
      }
    } catch (e) { storage_buckets = [{ error: `${e}` }]; }

    // 9. Enums
    let enums: any[] = [];
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/export_enums`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      if (resp.ok) enums = await resp.json();
    } catch { enums = []; }

    const result = {
      export_version: "2.1.0",
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
      storage_summary: {
        total_buckets: storage_buckets.length,
        total_files: totalFiles,
        embedded_files: embeddedFiles,
        skipped_large_files: skippedLargeFiles,
      },
      enums,
      jwt_secret: jwtSecret,
      anon_key: anonKey,
      supabase_url: supabaseUrl,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
