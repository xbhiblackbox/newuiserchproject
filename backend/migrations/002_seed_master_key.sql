-- ============================================================
-- Migration 002: Insert master access key for admin/owner
-- This key is used by the frontend to authenticate scraper requests.
-- ============================================================

INSERT INTO access_keys (key, label, active, max_devices, expires_at)
VALUES ('DARKSIDEX-MASTER-2025', 'Owner / Admin', true, 10, NULL)
ON CONFLICT DO NOTHING;
