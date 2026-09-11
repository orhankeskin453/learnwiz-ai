import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Override for the default localized "Loading…" label. */
  label?: string;
  className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-2 p-10", className)}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label ?? t("states.loading")}</span>
    </div>
  );
}
