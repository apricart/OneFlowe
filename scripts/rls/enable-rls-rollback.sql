-- ============================================================================
-- ROLLBACK for enable-rls.sql -- restores the pre-change Supabase defaults.
-- Run this only if you need to revert to the original (insecure) open state.
-- ============================================================================

-- 1) Restore default privileges for future objects created by `postgres`.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- 2) Restore grants on existing tables/sequences.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3) Disable RLS on every base table in public.
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
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
