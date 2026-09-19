-- RunForrest — Supabase kurulumu (tek dosya)
--
-- Supabase Dashboard → SQL Editor → bu dosyanın tamamını yapıştır → Run
--
-- ÖNEMLİ: Yarışmalar, katılım ücretleri, ödül havuzu ve rozetler BURADA DEĞİL.
-- Onlar Soroban kontratlarında yaşıyor (bkz. ../../deployments.json).
-- Supabase yalnızca zincire yazmanın anlamsız olduğu iki şeyi tutuyor:
--   1. GPS rota poligonları (binlerce nokta — zincirde pahalı ve gereksiz)
--   2. Yarışma üstverisi (başlık, açıklama, konum — kozmetik)
--
-- Bu tablolar olmadan da uygulama çalışır: koşu geçmişi devre dışı kalır,
-- yarışmalar "Yarışma #N" olarak görünür, zincire dayalı her şey aynen sürer.

-- ─────────────────────────────────────────────────────────────
-- 1. Koşular — GPS rotası ve koşu detayları
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
-- 2. Yarışma üstverisi — zincirdeki id'ye bağlı kozmetik alanlar
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenge_meta (
  -- runforrest_challenge kontratındaki yarışma id'si. Kaynak zincirdir.
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
