import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Override for the default localized unexpected-error message. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-3 p-10 text-center", className)}
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{message ?? t("errors.unexpected")}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
