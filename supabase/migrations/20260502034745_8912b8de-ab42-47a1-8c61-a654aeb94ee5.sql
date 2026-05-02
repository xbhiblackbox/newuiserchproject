DROP POLICY IF EXISTS "Public read search_cache" ON public.search_cache;
DROP POLICY IF EXISTS "Public insert search_cache" ON public.search_cache;
DROP POLICY IF EXISTS "Public update search_cache" ON public.search_cache;
DROP POLICY IF EXISTS "Public delete search_cache" ON public.search_cache;
-- No policies => only service_role bypasses RLS and can access. Frontend cannot touch this table.