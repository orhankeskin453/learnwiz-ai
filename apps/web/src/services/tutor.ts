import type { ChatResponse, ConversationDetail, TutorAction } from "@learwizai/types";
import { apiClient } from "./apiClient";
import type { Locale } from "@learwizai/types";

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

export async function getTutorQuota(): Promise<import("@learwizai/types").QuotaState> {
  return apiClient.get<import("@learwizai/types").QuotaState>("/api/tutor/quota");
}
