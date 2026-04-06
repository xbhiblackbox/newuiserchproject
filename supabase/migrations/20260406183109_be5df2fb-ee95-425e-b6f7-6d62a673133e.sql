-- Create reels_data table for persisting reel content and insights
CREATE TABLE public.reels_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account TEXT NOT NULL,
  post_index INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account, post_index)
);

-- Allow public read/write since this app uses access-key auth, not Supabase Auth
ALTER TABLE public.reels_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on reels_data"
  ON public.reels_data FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on reels_data"
  ON public.reels_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on reels_data"
  ON public.reels_data FOR UPDATE
  USING (true);

-- Create storage bucket for reel media (videos, thumbnails, music icons)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reel-media', 'reel-media', true);

-- Allow public read on reel-media bucket
CREATE POLICY "Public read reel-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reel-media');

-- Allow public upload to reel-media bucket
CREATE POLICY "Public upload reel-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reel-media');

-- Allow public update on reel-media bucket
CREATE POLICY "Public update reel-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'reel-media');