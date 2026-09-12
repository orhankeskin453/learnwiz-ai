-- Step 6: Learn Mode, Practice & Quiz persistence (CLAUDE.md §10.4–10.6, §16).
-- Additive. Timestamps ISO-8601 UTC TEXT. Owners: user XOR guest (§40.7).

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  owner_guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  -- Validated Lesson JSON (§10.4 block sequence) — small structured document.
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK ((owner_user_id IS NULL) <> (owner_guest_session_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_lessons_user ON lessons (owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lessons_guest ON lessons (owner_guest_session_id, created_at);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  owner_guest_session_id TEXT REFERENCES guest_sessions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'quiz' CHECK (kind IN ('quiz', 'practice')),
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'tr')),
  created_at TEXT NOT NULL,
  CHECK ((owner_user_id IS NULL) <> (owner_guest_session_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes (owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_guest ON quizzes (owner_guest_session_id, created_at);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  -- JSON string[] with exactly 4 options
  options TEXT NOT NULL,
  answer INTEGER NOT NULL CHECK (answer BETWEEN 0 AND 3),
  explanation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions (quiz_id, position);

-- Server-scored attempts (§16) — feed future progress/mastery (Phase 2+).
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  -- JSON number[] of the answering user's option indexes
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts (quiz_id, created_at);
