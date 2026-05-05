
CREATE TABLE public.api_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_key text,
  monthly_limit integer NOT NULL DEFAULT 500,
  used_count integer NOT NULL DEFAULT 0,
  alerted_warning boolean NOT NULL DEFAULT false,
  alerted_urgent boolean NOT NULL DEFAULT false,
  period_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role (edge functions) can access
INSERT INTO public.api_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
