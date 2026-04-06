
-- Create access_keys table for license key management
CREATE TABLE public.access_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT DEFAULT 'User',
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_devices INTEGER NOT NULL DEFAULT 1,
  device_fingerprints TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions use service role)
-- No public access policies needed
