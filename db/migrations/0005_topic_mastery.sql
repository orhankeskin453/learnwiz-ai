-- Step 9: topic mastery (CLAUDE.md §16, §10.8). Additive.
CREATE TABLE IF NOT EXISTS topic_mastery (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  owner_guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE CASCADE,
  topic_normalized TEXT NOT NULL,
  topic TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_questions INTEGER NOT NULL DEFAULT 0,
  mastery REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  CHECK ((owner_user_id IS NULL) <> (owner_guest_session_id IS NULL)),
  UNIQUE (owner_user_id, topic_normalized),
  UNIQUE (owner_guest_session_id, topic_normalized)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON topic_mastery (owner_user_id, mastery);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_guest ON topic_mastery (owner_guest_session_id, mastery);
