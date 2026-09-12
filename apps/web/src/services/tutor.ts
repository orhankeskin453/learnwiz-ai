import type {
  ChatResponse,
  ConversationDetail,
  Lesson,
  QuotaState,
  QuizAttemptResult,
  QuizGenerationResponse,
  TutorAction,
} from "@learwizai/types";
import type { Locale } from "@learwizai/types";
import { apiClient } from "./apiClient";

const CHAT_PATH = "/api/tutor/chat";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
  action: TutorAction;
}

/** Send one tutor turn (v1: non-streaming; the full answer returns with exact usage). */
export async function sendTutorMessage(input: {
  message: string;
  action: TutorAction;
  locale: Locale;
  conversationId?: string;
}): Promise<ChatResponse> {
  return apiClient.post<ChatResponse>(CHAT_PATH, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId: input.conversationId,
      message: input.message,
      action: input.action,
      locale: input.locale,
    }),
  });
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return apiClient.get<ConversationDetail>(`/api/tutor/conversations/${id}`);
}

export async function listConversations(): Promise<
  import("@learwizai/types").ConversationSummary[]
> {
  return apiClient.get<import("@learwizai/types").ConversationSummary[]>(
    "/api/tutor/conversations",
  );
}

export async function getTutorQuota(): Promise<QuotaState> {
  return apiClient.get<QuotaState>("/api/tutor/quota");
}

/** ---- Learning features (Step 6) ---- */

export async function generateLesson(input: {
  topic: string;
  locale: Locale;
}): Promise<{ lessonId: string; lesson: Lesson }> {
  return apiClient.post<{ lessonId: string; lesson: Lesson }>("/api/learn/lessons", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function generatePractice(input: {
  topic: string;
  count: number;
  locale: Locale;
}): Promise<QuizGenerationResponse> {
  return apiClient.post<QuizGenerationResponse>("/api/practice", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function generateQuiz(input: {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  count: number;
  locale: Locale;
}): Promise<QuizGenerationResponse> {
  return apiClient.post<QuizGenerationResponse>("/api/quiz", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function submitQuizAttempt(
  quizId: string,
  answers: number[],
): Promise<QuizAttemptResult> {
  return apiClient.post<QuizAttemptResult>(`/api/quiz/${quizId}/attempts`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}
