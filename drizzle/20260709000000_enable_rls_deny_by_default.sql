-- Enable Row Level Security (deny-by-default) on all public base tables.
-- The app connects as Postgres role `postgres` (BYPASSRLS + owns every table),
-- so RLS is transparent to all Drizzle queries; it only closes the public
-- anon/authenticated PostgREST path (which previously exposed every table,
-- including users.password_hash). App roles (SUPER_ADMIN/HEAD_OFFICE/
-- BRANCH_ADMIN/ORDER_PORTAL) are enforced in application code, not Postgres
-- roles, and are unaffected. Idempotent: safe to re-run. Full context and
-- rollback in scripts/rls/enable-rls.sql and scripts/rls/enable-rls-rollback.sql.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
--> statement-breakpoint
-- Defense in depth: revoke the blanket anon/authenticated grants and stop future
-- tables/sequences from auto-granting to them. Guarded so this is a no-op on
-- non-Supabase databases (e.g. local dev) where these roles do not exist.
-- service_role is intentionally left untouched.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
