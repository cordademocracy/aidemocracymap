CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org TEXT NOT NULL,
  draft TEXT,
  contributor_name TEXT,
  contributor_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_slug TEXT NOT NULL,
  changes TEXT NOT NULL,
  contributor_name TEXT,
  contributor_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rate_counters (
  key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_logins (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at);
CREATE INDEX IF NOT EXISTS idx_edits_created ON edits (created_at);
CREATE INDEX IF NOT EXISTS idx_rate_counters_window ON rate_counters (window_start);

CREATE TABLE IF NOT EXISTS organizations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ai_democracy_angle TEXT NOT NULL DEFAULT '',
  focus_tags TEXT NOT NULL DEFAULT '[]',
  location TEXT NOT NULL DEFAULT '',
  founded INTEGER,
  funders TEXT NOT NULL DEFAULT '[]',
  key_projects TEXT NOT NULL DEFAULT '[]',
  logo_domain TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  depth_ring TEXT NOT NULL DEFAULT 'core',
  updated_at TEXT NOT NULL
);
