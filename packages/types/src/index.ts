/** Locales supported at launch (CLAUDE.md §6). English is the fallback. */
export type Locale = "en" | "tr";

/** Response body of GET /api/health (CLAUDE.md Step 1 foundation). */
export interface HealthResponse {
  status: "ok";
  service: "learnwizai-api";
  environment: string;
  timestamp: string;
  checks: {
    db: "ok" | "unavailable";
  };
}

/** Guest-feature capabilities gated by entitlements (CLAUDE.md §5.1, §17). */
export type Feature = "ai_tutor" | "learn_mode" | "practice" | "quiz";

/** Per-feature usage snapshot for an identity. Limits are server-authoritative. */
export interface FeatureUsage {
  feature: Feature;
  used: number;
  /** Max uses allowed for this identity/session; 0 means unavailable. */
  limit: number;
}

/** Response body of POST/GET /api/guest/session (CLAUDE.md §5, §22). */
export interface GuestSessionResponse {
  /** ISO-8601 UTC instant — when the guest session expires (fixed 7-day window). */
  expiresAt: string;
  usage: FeatureUsage[];
}

/** Machine-readable API error codes (envelope: `{ error, message? }`). */
export type ApiErrorCode =
  | "not_found"
  | "guest_session_not_found"
  | "guest_session_invalid"
  | "rate_limited"
  | "config_error"
  | "internal_error"
  | "ai_limit_reached"
  | "ai_unavailable"
  | "quota_exhausted"
  | "conversation_not_found"
  | "document_not_found"
  | "document_not_ready"
  | "payload_too_large"
  | "unsupported_media_type";

export interface ApiErrorBody {
  error: ApiErrorCode;
  message?: string;
}

/** User profile exposed by GET /api/auth/me — never includes credentials. */
export interface UserProfile {
  id: string;
  email: string;
  locale: Locale;
  status: "pending" | "active" | "suspended" | "deleted";
  emailVerified: boolean;
  createdAt: string;
}

/** Body of POST /api/auth/login|verify-email (session created). */
export interface AuthSessionResponse {
  user: UserProfile;
}

/** Generic anti-enumeration body for register / password-reset requests (§40.9). */
export interface GenericAuthResponse {
  ok: true;
}

/** Additional machine-readable auth error codes (envelope: `{ error, message? }`). */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_verified"
  | "account_suspended"
  | "validation_error"
  | "unauthenticated"
  | "invalid_token";

/** §10.3 AI Tutor learning actions + free chat. */
export type TutorAction =
  "chat" | "explain" | "simplify" | "give_example" | "quiz_me" | "give_exercise" | "summarize";

/** Body of POST /api/tutor/chat (§33). Locale drives the AI response language (§6.4). */
export interface ChatRequest {
  conversationId?: string;
  message: string;
  action?: TutorAction;
  locale: Locale;
}

/** Body of POST /api/tutor/chat (spec D8, v1 non-streaming — exact §13.6 usage). */
export interface ChatResponse {
  conversationId: string;
  assistantMessage: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    fallback: boolean;
  };
}

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  action: TutorAction | null;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  locale: Locale;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: TutorMessage[];
}

/** Remaining AI quota for the resolved identity (§10.3 usage indicator). */
export interface QuotaState {
  used: number;
  limit: number;
  /** Admin/testing accounts bypass quotas (limit display hidden client-side). */
  unlimited?: boolean;
}

/** §10.4 structured lesson — the six blocks always in teaching order. */
export type LessonBlockKind =
  "concept" | "intuition" | "example" | "common_mistakes" | "mini_exercise" | "check_understanding";

export interface LessonBlock {
  kind: LessonBlockKind;
  content: string;
  /** Only on check_understanding. */
  question?: string;
  answer?: string;
}

export interface Lesson {
  title: string;
  blocks: LessonBlock[];
}

export interface LessonSummary {
  id: string;
  topic: string;
  locale: Locale;
  createdAt: string;
}

/** §10.5/§10.6 MCQ question (answers ship for instant client-side feedback). */
export interface PracticeQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export type QuizDifficulty = "easy" | "medium" | "hard";

export interface GeneratedQuiz {
  id: string;
  topic: string;
  difficulty: QuizDifficulty;
  locale: Locale;
  questions: PracticeQuestion[];
}

export interface QuizAttemptResult {
  score: number;
  total: number;
}

/** Body of POST /api/practice and POST /api/quiz (§10.5/§10.6). */
export interface QuizGenerationResponse {
  quizId: string;
  questions: PracticeQuestion[];
}

/** Aggregated dashboard payload (§10.2). */
export interface DashboardData {
  continueLearning: { id: string; title: string; updatedAt: string } | null;
  recentLessons: Array<{ id: string; topic: string; createdAt: string }>;
  quiz: { attempts: number; avgMastery: number } | null;
  topics: Array<{ topic: string; mastery: number }>;
  aiUsage: QuotaState;
}

/** §10.1 document lifecycle + RAG chat contracts (Step 10). */
export type DocumentStatus = "queued" | "processing" | "processed" | "failed";

export interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
}

export interface RagSource {
  position: number;
  excerpt: string;
}

export interface DocumentChatResponse {
  answer: string;
  sources: RagSource[];
}
