-- Step 5: AI Tutor persistence + usage accounting (CLAUDE.md §14, §16).
-- Additive on 0001/0002. Timestamps: ISO-8601 UTC TEXT.

-- Tutor conversations. Exactly one owner (guest OR user) — CHECK-enforced (§40.7).
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  owner_guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (owner_user_id IS NULL) <> (owner_guest_session_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations (owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations (owner_guest_session_id, updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  action TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

-- AI usage ledger (§14). One row per AI call. user_id XOR guest_session_id.
-- neurons/estimated_cost/cached_tokens reserved for the billing step (nullable).
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'tutor',
  input_tokens INTEGER,
  output_tokens INTEGER,
  cached_tokens INTEGER,
  neurons INTEGER,
  estimated_cost REAL,
  latency_ms INTEGER,
  plan TEXT NOT NULL CHECK (plan IN ('guest', 'free', 'learner', 'pro')),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  routed_fallback INTEGER NOT NULL DEFAULT 0,
  usage_estimated INTEGER NOT NULL DEFAULT 0,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_guest ON ai_usage (guest_session_id);
