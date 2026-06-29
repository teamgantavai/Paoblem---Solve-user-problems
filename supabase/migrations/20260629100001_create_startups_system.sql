-- =========================================================
-- Startups System Migration
-- Creates startups, applications, members, updates, follows,
-- and AI match tables with full RLS and indexes.
-- =========================================================

-- ── 1. Startups table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS startups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 120),
  slug              TEXT UNIQUE,
  logo_url          TEXT,
  banner_url        TEXT,
  tagline           TEXT CHECK (char_length(tagline) <= 200),
  description       TEXT,
  stage             TEXT NOT NULL DEFAULT 'Idea'
                      CHECK (stage IN ('Idea','Validation','MVP','Beta','Launched','Revenue','Funded')),
  industry          TEXT,
  funding_stage     TEXT,
  website           TEXT,
  compensation_type TEXT DEFAULT 'Equity'
                      CHECK (compensation_type IN ('Equity','Paid','Internship','Volunteer','Revenue Share')),
  work_type         TEXT DEFAULT 'Remote'
                      CHECK (work_type IN ('Remote','Hybrid','On-site')),
  looking_for       TEXT[] DEFAULT '{}',
  required_skills   TEXT[] DEFAULT '{}',
  deadline          TIMESTAMPTZ,
  -- engagement counters (denormalised for performance)
  followers_count   INT DEFAULT 0,
  applications_count INT DEFAULT 0,
  -- future-ready
  verified          BOOLEAN DEFAULT FALSE,
  investor_mode     BOOLEAN DEFAULT FALSE,
  equity_offered    TEXT,
  -- timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- slug generation helper (fill slug from name if blank)
CREATE OR REPLACE FUNCTION generate_startup_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(NEW.id::TEXT, 1, 8);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_startup_slug ON startups;
CREATE TRIGGER trg_startup_slug
  BEFORE INSERT OR UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION generate_startup_slug();

-- ── 2. Startup Applications ───────────────────────────────
CREATE TABLE IF NOT EXISTS startup_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id      UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro           TEXT,
  reason          TEXT,
  portfolio_links TEXT[] DEFAULT '{}',
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected')),
  applied_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (startup_id, applicant_id)
);

-- Counter trigger for startup.applications_count
CREATE OR REPLACE FUNCTION update_startup_applications_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE startups SET applications_count = applications_count + 1 WHERE id = NEW.startup_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE startups SET applications_count = GREATEST(applications_count - 1, 0) WHERE id = OLD.startup_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_startup_app_count ON startup_applications;
CREATE TRIGGER trg_startup_app_count
  AFTER INSERT OR DELETE ON startup_applications
  FOR EACH ROW EXECUTE FUNCTION update_startup_applications_count();

-- ── 3. Startup Members ────────────────────────────────────
CREATE TABLE IF NOT EXISTS startup_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id  UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (startup_id, user_id)
);

-- ── 4. Startup Updates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS startup_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id  UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Startup Follows ────────────────────────────────────
CREATE TABLE IF NOT EXISTS startup_follows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id  UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (startup_id, user_id)
);

-- Counter trigger for startup.followers_count
CREATE OR REPLACE FUNCTION update_startup_followers_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE startups SET followers_count = followers_count + 1 WHERE id = NEW.startup_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE startups SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.startup_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_startup_follow_count ON startup_follows;
CREATE TRIGGER trg_startup_follow_count
  AFTER INSERT OR DELETE ON startup_follows
  FOR EACH ROW EXECUTE FUNCTION update_startup_followers_count();

-- ── 6. AI Match Cache ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS startup_ai_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_score   NUMERIC(5,2) DEFAULT 0,   -- 0.00 – 100.00
  match_reasons TEXT[] DEFAULT '{}',
  computed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (startup_id, user_id)
);

-- ── 7. Row-Level Security ─────────────────────────────────

ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_ai_matches ENABLE ROW LEVEL SECURITY;

-- startups: anyone can read, founder can write
CREATE POLICY "startups_select" ON startups FOR SELECT USING (TRUE);
CREATE POLICY "startups_insert" ON startups FOR INSERT WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "startups_update" ON startups FOR UPDATE USING (auth.uid() = founder_id);
CREATE POLICY "startups_delete" ON startups FOR DELETE USING (auth.uid() = founder_id);

-- applications: applicant can manage their own; founder can read all for their startup
CREATE POLICY "startup_apps_select_own" ON startup_applications
  FOR SELECT USING (auth.uid() = applicant_id OR
    auth.uid() IN (SELECT founder_id FROM startups WHERE id = startup_id));
CREATE POLICY "startup_apps_insert" ON startup_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "startup_apps_update_founder" ON startup_applications
  FOR UPDATE USING (
    auth.uid() IN (SELECT founder_id FROM startups WHERE id = startup_id)
  );

-- members: public read
CREATE POLICY "startup_members_select" ON startup_members FOR SELECT USING (TRUE);
CREATE POLICY "startup_members_insert" ON startup_members FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT founder_id FROM startups WHERE id = startup_id)
);

-- updates: public read, founder can write
CREATE POLICY "startup_updates_select" ON startup_updates FOR SELECT USING (TRUE);
CREATE POLICY "startup_updates_insert" ON startup_updates FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT founder_id FROM startups WHERE id = startup_id)
);

-- follows: anyone logged in can follow
CREATE POLICY "startup_follows_select" ON startup_follows FOR SELECT USING (TRUE);
CREATE POLICY "startup_follows_insert" ON startup_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "startup_follows_delete" ON startup_follows FOR DELETE USING (auth.uid() = user_id);

-- ai matches: public read (scores are non-sensitive)
CREATE POLICY "startup_ai_matches_select" ON startup_ai_matches FOR SELECT USING (TRUE);
CREATE POLICY "startup_ai_matches_upsert" ON startup_ai_matches FOR ALL USING (TRUE);

-- ── 8. Performance Indexes ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_startups_founder ON startups(founder_id);
CREATE INDEX IF NOT EXISTS idx_startups_stage ON startups(stage);
CREATE INDEX IF NOT EXISTS idx_startups_industry ON startups(industry);
CREATE INDEX IF NOT EXISTS idx_startups_created ON startups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startup_apps_startup ON startup_applications(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_apps_applicant ON startup_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_startup_follows_startup ON startup_follows(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_follows_user ON startup_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_startup_ai_matches_startup ON startup_ai_matches(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_ai_matches_user ON startup_ai_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_startup_members_startup ON startup_members(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_updates_startup ON startup_updates(startup_id, created_at DESC);
