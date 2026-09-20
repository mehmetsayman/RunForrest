-- RunForrest — Supabase setup (single file)
--
-- Supabase Dashboard → SQL Editor → paste this whole file → Run
--
-- IMPORTANT: challenges, entry fees, the prize pool and badges are NOT HERE.
-- They live in the Soroban contracts (see ../../deployments.json).
-- Supabase holds only the two things not worth writing to chain:
--   1. GPS route polylines (thousands of points — expensive and pointless on chain)
--   2. Challenge metadata (title, description, location — cosmetic)
--
-- The app works without these tables: run history is disabled, challenges
-- show as "Challenge #N", and everything chain-backed carries on unchanged.

-- ─────────────────────────────────────────────────────────────
-- 1. Runs — GPS route and run details
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  duration_seconds INTEGER NOT NULL,
  pace TEXT,
  calories INTEGER,
  avg_speed REAL,
  positions JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_wallet_idx ON runs (wallet_address);
CREATE INDEX IF NOT EXISTS runs_created_idx ON runs (created_at DESC);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert runs" ON runs;
CREATE POLICY "Anyone can insert runs" ON runs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read runs" ON runs;
CREATE POLICY "Anyone can read runs" ON runs FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. Challenge metadata — cosmetic fields keyed by the on-chain id
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenge_meta (
  -- The challenge id in the runforrest_challenge contract. The chain is the source.
  challenge_id INTEGER PRIMARY KEY,
  title TEXT,
  description TEXT,
  location TEXT,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE challenge_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read challenge meta" ON challenge_meta;
CREATE POLICY "Anyone can read challenge meta" ON challenge_meta FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can write challenge meta" ON challenge_meta;
CREATE POLICY "Anyone can write challenge meta" ON challenge_meta FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update challenge meta" ON challenge_meta;
CREATE POLICY "Anyone can update challenge meta" ON challenge_meta FOR UPDATE USING (true);

-- Kontrol:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('runs', 'challenge_meta');
