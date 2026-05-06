-- ============================================================
-- Migration 001: Initial schema
-- Matches exact Supabase schema byte-for-byte
-- ============================================================

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. access_keys
-- ============================================================
CREATE TABLE IF NOT EXISTS access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  label text DEFAULT 'User',
  active bool NOT NULL DEFAULT true,
  max_devices int NOT NULL DEFAULT 1,
  device_fingerprints text[] DEFAULT '{}',
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS access_keys_key_idx ON access_keys (key);
CREATE INDEX IF NOT EXISTS access_keys_active_idx ON access_keys (active);

-- ============================================================
-- 2. api_settings (single row, id = 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_settings (
  id int PRIMARY KEY DEFAULT 1,
  current_key text NULL,
  monthly_limit int NOT NULL DEFAULT 500,
  used_count int NOT NULL DEFAULT 0,
  alerted_warning bool NOT NULL DEFAULT false,
  alerted_urgent bool NOT NULL DEFAULT false,
  period_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single settings row
INSERT INTO api_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. reels_data
-- ============================================================
CREATE TABLE IF NOT EXISTS reels_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  post_index int NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reels_data_account_idx ON reels_data (account);
CREATE UNIQUE INDEX IF NOT EXISTS reels_data_account_post_idx ON reels_data (account, post_index);

-- ============================================================
-- 4. search_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS search_cache (
  cache_key text PRIMARY KEY,
  username text NOT NULL,
  type text NOT NULL,
  pages int NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  hits int NOT NULL DEFAULT 0,
  stored_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS search_cache_username_idx ON search_cache (username);
CREATE INDEX IF NOT EXISTS search_cache_expires_idx ON search_cache (expires_at);
