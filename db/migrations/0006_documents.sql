-- Step 10: documents + RAG chunks (CLAUDE.md §12.1, §15, §16). Additive.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  owner_guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','processed','failed')),
  error TEXT,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','tr')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((owner_user_id IS NULL) <> (owner_guest_session_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_guest ON documents (owner_guest_session_id, created_at);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks (document_id, position);
