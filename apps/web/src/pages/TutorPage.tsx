import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/apiClient";
import { createGuestSession } from "@/services/guestSessions";
import {
  getConversation,
  getTutorQuota,
  listConversations,
  sendTutorMessage,
  type TutorTurn,
} from "@/services/tutor";
import { getActiveLocale } from "@/i18n";
import type { ChatResponse, QuotaState, TutorAction } from "@learwizai/types";

/** Suggested learning actions (§10.3) — chat is the implicit default. */
const SUGGESTED_ACTIONS = [
  "explain",
  "simplify",
  "give_example",
  "quiz_me",
  "give_exercise",
  "summarize",
] as const satisfies readonly TutorAction[];

interface Turn extends TutorTurn {
  pending?: boolean;
}

/** AI Tutor page (CLAUDE.md §10.3): suggested actions + conversation + input. */
export function TutorPage() {
  const { t } = useTranslation("tutor");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<TutorAction>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<"limit" | "unavailable" | "generic" | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);

  // Guest session first (idempotent — reuses the existing cookie): the tutor is
  // the first touchpoint for most visitors, and /api/tutor/* 401s without it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await createGuestSession();
      } catch {
        /* chat will surface a retry-able error if the session cannot be created */
      }
      if (cancelled) return;
      // Quota hint — independent of whether a conversation could be resumed.
      try {
        if (!cancelled) setQuota(await getTutorQuota());
      } catch {
        /* hint only */
      }
      try {
        const conversations = await listConversations();
        if (cancelled || conversations.length === 0) return;
        const detail = await getConversation(conversations[0]!.id);
        if (cancelled) return;
        setConversationId(detail.id);
        setTurns(
          detail.messages.map((m) => ({
            role: m.role,
            content: m.content,
            action: m.action ?? "chat",
          })),
        );
      } catch {
        /* best-effort resume */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshQuota(): Promise<void> {
    try {
      setQuota(await getTutorQuota());
    } catch {
      /* hint only */
    }
  }

  /** Send one turn. A missing/expired guest session is bootstrapped and the
   * request replayed centrally by the api client, so no local retry is needed. */
  async function sendChat(): Promise<ChatResponse> {
    return sendTutorMessage({
      message: input.trim(),
      action,
      locale: getActiveLocale(),
      conversationId,
    });
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    const history = [...turns, { role: "user" as const, content: message, action }];
    setTurns([...history, { role: "assistant", content: "", action, pending: true }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await sendChat();
      setConversationId(response.conversationId);
      setTurns([...history, { role: "assistant", content: response.assistantMessage, action }]);
      void refreshQuota();
    } catch (err) {
      // Keep the user's message visible; drop the placeholder and explain (§29).
      setTurns(history);
      if (err instanceof ApiError && err.code === "ai_limit_reached") setError("limit");
      else if (err instanceof ApiError && err.code === "ai_unavailable") setError("unavailable");
      else setError("generic");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section aria-label={t("suggested.label")} className="flex flex-wrap gap-2">
        {SUGGESTED_ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            aria-pressed={action === a}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              action === a
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {t(`suggested.${a}`)}
          </button>
        ))}
      </section>

      <section
        aria-label={t("title")}
        aria-live="polite"
        className="space-y-4 rounded-[20px] border border-border bg-card p-5 min-h-64"
      >
        {turns.length === 0 && !sending ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-lg">
              <Sparkles className="size-6" aria-hidden="true" />
            </span>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{t("chat.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {t("chat.emptyDescription")}
              </p>
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[85%] rounded-[18px] px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                turn.role === "user"
                  ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-secondary text-secondary-foreground",
                turn.pending && "animate-pulse text-muted-foreground",
              )}
            >
              {turn.pending ? t("input.sending") : turn.content}
            </div>
          ))
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error === "limit"
            ? t("errors.limitReached")
            : error === "unavailable"
              ? t("errors.unavailable")
              : t("errors.generic")}
        </p>
      )}

      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-[20px] border border-border bg-card p-2 transition-colors focus-within:border-ring/70"
      >
        <div className="grid flex-1 gap-1.5">
          <label htmlFor="tutor-input" className="sr-only">
            {t("input.label")}
          </label>
          <Input
            id="tutor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("input.placeholder")}
            maxLength={2000}
            disabled={sending}
            className="border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          />
          {quota && !quota.unlimited && (
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              {t("quota.remaining", { used: quota.used, limit: quota.limit })}
            </p>
          )}
        </div>
        <Button type="submit" disabled={sending || input.trim().length === 0}>
          {sending ? t("input.sending") : t("input.send")}
        </Button>
      </form>
    </div>
  );
}
