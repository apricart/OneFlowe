-- ============================================================================
-- Enable Row Level Security (deny-by-default) on all public tables
-- ----------------------------------------------------------------------------
-- Context (verified 2026-07-08):
--   * The app connects as Postgres role `postgres`, which has BYPASSRLS = true
--     AND owns all 42 public tables. RLS is therefore fully transparent to the
--     application: every Drizzle query (all app data access goes through the
--     single `postgres` pool in lib/db.ts) is unaffected.
--   * The app's own roles (SUPER_ADMIN / HEAD_OFFICE / BRANCH_ADMIN /
--     ORDER_PORTAL) are application-level concepts enforced in code
--     (lib/permissions.ts, middleware.ts) -- NOT Postgres roles -- so this
--     change does not touch them.
--   * The app does NOT use @supabase/supabase-js or PostgREST; the anon /
--     authenticated keys are unused by application code. This change closes the
--     public PostgREST data path (which currently exposes every table,
--     including users.password_hash) without affecting the app.
--
-- Effect: anon/authenticated (via PostgREST) get NOTHING (RLS on, no policies).
--         service_role (BYPASSRLS) and postgres are unaffected.
--
-- Reversible via enable-rls-rollback.sql
-- ============================================================================

-- 1) Enable RLS on every base table in public. No policies are created, so the
--    only roles that can read/write are those with BYPASSRLS (postgres,
--    service_role) or the table owner (postgres). Deny-by-default for anon.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- 2) Defense in depth: remove the blanket PostgREST grants that anon/authenticated
--    currently hold on all tables and sequences. (service_role keeps its grants.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3) Durability: stop FUTURE tables/sequences created by `postgres` (i.e. future
--    Drizzle migrations) from auto-granting to anon/authenticated. Without this,
--    the next migration would re-open the hole for any new table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
