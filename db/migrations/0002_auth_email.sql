-- Step 4: authentication + email foundation (CLAUDE.md §40, §47).
-- Additive on top of 0001_guest_identity. Timestamps: ISO-8601 UTC TEXT.

-- Verification / password-reset tokens (§40.9): 256-bit random tokens are only
-- stored as SHA-256 hashes; single-use via consumed_at; purpose-typed expiry
-- (email_verification 24h, password_reset 1h — enforced by services).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens (expires_at);

-- Transactional email outbox (§47.13): the state change commits first, the send
-- attempt is recorded here; retries read from this table. No sensitive content.
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('verification', 'welcome', 'password_reset', 'security')),
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  template_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider TEXT NOT NULL DEFAULT 'log',
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_events_status ON email_events (status);

-- Audit log (§40.16/§47.15): privileged/auth-relevant state changes. Immutable
-- from the application surface; no passwords, tokens, or secrets — ids only.
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events (action);
