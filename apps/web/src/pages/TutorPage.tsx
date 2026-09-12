import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/apiClient";
import {
  getConversation,
  getTutorQuota,
  listConversations,
  sendTutorMessage,
  type TutorTurn,
} from "@/services/tutor";
import { getActiveLocale } from "@/i18n";
import type { QuotaState, TutorAction } from "@learwizai/types";

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

  // Resume the latest conversation (§29) + quota hint (§10.3) — both best-effort.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
    void (async () => {
      try {
        setQuota(await getTutorQuota());
      } catch {
        /* hint only */
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
      const response = await sendTutorMessage({
        message,
        action,
        locale: getActiveLocale(),
        conversationId,
      });
      setConversationId(response.conversationId);
      setTurns([...history, { role: "assistant", content: response.assistantMessage, action }]);
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
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
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
        className="space-y-4 rounded-lg border border-border bg-card p-5 min-h-64"
      >
        {turns.length === 0 && !sending ? (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{t("chat.emptyTitle")}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t("chat.emptyDescription")}
              </p>
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap",
                turn.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
                turn.pending && "animate-pulse text-muted-foreground",
              )}
            >
              {turn.pending ? t("input.sending") : turn.content}
            </div>
          ))
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error === "limit"
            ? t("errors.limitReached")
            : error === "unavailable"
              ? t("errors.unavailable")
              : t("errors.generic")}
        </p>
      )}

      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="grid flex-1 gap-2">
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
          />
          {quota && (
            <p className="text-xs text-muted-foreground">
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
