
-- Helper functions for export-data edge function (TEMPORARY - remove after migration)

CREATE OR REPLACE FUNCTION public.export_rls_policies()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
  FROM pg_policies p
  WHERE p.schemaname = 'public';
$$;

CREATE OR REPLACE FUNCTION public.export_db_functions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'args', pg_get_function_arguments(p.oid),
    'return_type', pg_get_function_result(p.oid),
    'definition', pg_get_functiondef(p.oid),
    'language', l.lanname
  )), '[]'::jsonb)
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  JOIN pg_language l ON p.prolang = l.oid
  WHERE n.nspname = 'public';
$$;

CREATE OR REPLACE FUNCTION public.export_triggers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'trigger_name', t.tgname,
    'table_schema', n.nspname,
    'table_name', c.relname,
    'definition', pg_get_triggerdef(t.oid)
  )), '[]'::jsonb)
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname IN ('public', 'auth')
    AND NOT t.tgisinternal;
$$;

CREATE OR REPLACE FUNCTION public.export_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  BEGIN
    EXECUTE 'SELECT coalesce(jsonb_agg(row_to_json(j)::jsonb), ''[]''::jsonb) FROM cron.job j' INTO result;
  EXCEPTION WHEN OTHERS THEN
    result := '[]'::jsonb;
  END;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.export_auth_identities()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'user_id', i.user_id,
    'provider', i.provider,
    'provider_id', i.provider_id,
    'identity_data', i.identity_data,
    'created_at', i.created_at,
    'updated_at', i.updated_at,
    'last_sign_in_at', i.last_sign_in_at
  )), '[]'::jsonb)
  FROM auth.identities i;
$$;

CREATE OR REPLACE FUNCTION public.export_enums()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'type_name', t.typname,
    'values', (
      SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
      FROM pg_enum e WHERE e.enumtypid = t.oid
    )
  )), '[]'::jsonb)
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.typtype = 'e';
$$;
