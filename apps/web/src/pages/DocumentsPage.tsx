import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/apiClient";
import { type LearningErrorKind } from "@/components/learning/errors";

function uploadErrorKind(err: unknown): LearningErrorKind {
  if (err instanceof ApiError) {
    if (err.code === "payload_too_large") return "tooLarge";
    if (err.code === "unsupported_media_type") return "unsupported";
    if (err.code === "quota_exhausted") return "limit";
    if (err.code === "ai_unavailable") return "unavailable";
  }
  return "generic";
}
import {
  chatWithDocument,
  deleteDocument,
  listDocuments,
  uploadDocument,
  type DocumentInfo,
} from "@/services/documents";
import { getActiveLocale } from "@/i18n";
import type { DocumentStatus } from "@learwizai/types";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const STATUS_VARIANT: Record<DocumentStatus, "secondary" | "success" | "warning" | "destructive"> =
  {
    queued: "warning" as never,
    processing: "warning",
    processed: "success" as never,
    failed: "destructive",
  };

/** Documents (§10.1): upload → status → per-document chat. */
export function DocumentsPage() {
  const { t } = useTranslation("documents");
  const [docs, setDocs] = useState<DocumentInfo[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<LearningErrorKind | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDocs(await listDocuments());
    } catch {
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Poll while any document is queued/processing (§15 status lifecycle).
  useEffect(() => {
    const pending = docs?.some((d) => d.status === "queued" || d.status === "processing");
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 3000);
    }
    if (!pending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [docs, refresh]);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file, getActiveLocale());
      setFile(null);
      (document.getElementById("doc-file") as HTMLInputElement).value = "";
      await refresh();
    } catch (err) {
      setError(uploadErrorKind(err));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string): Promise<void> {
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteDocument(id).catch(() => undefined);
    if (activeId === id) setActiveId(null);
    await refresh();
  }

  async function ask(event?: React.FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || !activeId || asking) return;
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setAsking(true);
    try {
      const response = await chatWithDocument(activeId, message, getActiveLocale());
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources.map((s) => `[${s.position + 1}] ${s.excerpt}…`),
        },
      ]);
    } catch (err) {
      setTurns((prev) => prev.filter((turn) => turn.content !== ""));
      setError(
        err instanceof ApiError && err.code === "ai_unavailable" ? "unavailable" : "generic",
      );
    } finally {
      setAsking(false);
    }
  }

  const activeDoc = docs?.find((d) => d.id === activeId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-[20px] border border-dashed border-border bg-card/60 p-5"
      >
        <div className="grid min-w-52 flex-1 gap-2">
          <label htmlFor="doc-file" className="text-sm font-semibold text-foreground">
            {t("uploadLabel")}
          </label>
          <Input
            id="doc-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </div>
        <Button type="submit" disabled={!file || uploading}>
          {uploading ? t("uploading") : t("uploadButton")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error === "limit"
            ? t("errors.limit")
            : error === "tooLarge"
              ? t("errors.tooLarge")
              : error === "unsupported"
                ? t("errors.unsupported")
                : error === "unavailable"
                  ? t("errors.unavailable")
                  : t("errors.generic")}
        </p>
      )}

      <section aria-label={t("listTitle")} className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t("listTitle")}</h2>
        {docs === null ? (
          <div className="h-16 w-full animate-pulse rounded-md bg-muted" aria-busy="true" />
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          docs.map((doc) => (
            <Card
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-[16px] p-4 transition-colors hover:border-border/70"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{doc.title}</p>
                {doc.status === "failed" && (
                  <p className="text-xs text-destructive">{t("failedReason", { reason: "" })}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[doc.status]}>{t(`status.${doc.status}`)}</Badge>
              <div className="flex items-center gap-2">
                {doc.status === "processed" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveId(doc.id);
                      setTurns([]);
                    }}
                  >
                    {t("chatTitle", { title: "" })}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(doc.id)}
                  aria-label={`${t("delete")}: ${doc.title}`}
                >
                  {t("delete")}
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      {activeDoc && activeDoc.status === "processed" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("chatTitle", { title: activeDoc.title })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div aria-live="polite" className="space-y-3">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === "user"
                      ? "ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground"
                      : "max-w-[85%] rounded-[18px] rounded-bl-md bg-secondary px-4 py-2.5 text-sm leading-6 text-secondary-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                  {turn.sources && turn.sources.length > 0 && (
                    <p className="mt-2 text-xs opacity-80">{t("sources")}</p>
                  )}
                  {turn.sources?.map((s) => (
                    <p key={s} className="mt-1 text-xs opacity-60">
                      {s}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <form onSubmit={ask} className="flex items-end gap-2">
              <div className="grid flex-1 gap-2">
                <label htmlFor="doc-chat-input" className="sr-only">
                  {t("chatPlaceholder")}
                </label>
                <Input
                  id="doc-chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("chatPlaceholder")}
                  maxLength={1000}
                  disabled={asking}
                />
              </div>
              <Button type="submit" disabled={asking || input.trim().length === 0}>
                {t("send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
