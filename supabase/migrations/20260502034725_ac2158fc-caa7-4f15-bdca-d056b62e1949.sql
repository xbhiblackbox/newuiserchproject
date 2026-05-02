CREATE TABLE IF NOT EXISTS public.search_cache (
  cache_key text PRIMARY KEY,
  username text NOT NULL,
  type text NOT NULL,
  pages integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  stored_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_username ON public.search_cache (username);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON public.search_cache (expires_at);

ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read search_cache" ON public.search_cache FOR SELECT USING (true);
CREATE POLICY "Public insert search_cache" ON public.search_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update search_cache" ON public.search_cache FOR UPDATE USING (true);
CREATE POLICY "Public delete search_cache" ON public.search_cache FOR DELETE USING (true);