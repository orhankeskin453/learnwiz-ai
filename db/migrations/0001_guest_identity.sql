-- Step 3: guest session + identity foundations (CLAUDE.md §5, §16, §47.9).
-- Additive migration; timestamps are ISO-8601 UTC TEXT.

-- Identity core. Nothing writes users/sessions until the auth step (§48 item 6);
-- the schema lands now so the identity middleware contract is stable.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Store a hash of the session token, never the raw token (CLAUDE.md §47.9).
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Anonymous trial sessions (CLAUDE.md §5). The cookie carries `id.signature`;
-- the row is the server-authoritative state.
CREATE TABLE IF NOT EXISTS guest_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  migration_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (migration_status IN ('pending', 'migrated', 'expired')),
  -- Peppered IP hash, only when abuse controls require it (§5).
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at ON guest_sessions (expires_at);

-- Per-capability usage for guest entitlements (§5.1). One row per (session, feature);
-- limits live in worker-side entitlements configuration, never in the frontend.
CREATE TABLE IF NOT EXISTS guest_usage (
  guest_session_id TEXT NOT NULL REFERENCES guest_sessions (id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('ai_tutor', 'learn_mode', 'practice', 'quiz')),
  used INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  PRIMARY KEY (guest_session_id, feature)
);
