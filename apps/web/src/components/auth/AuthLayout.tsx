import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Minimal centered layout for the conversion-funnel auth pages (§10.9) —
 * rendered OUTSIDE the app shell (spec D1).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("nav");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          {/* Brand name is a proper noun — not translated (documented exception). */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            LearnWiz AI
          </Link>
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </header>
        <div className="rounded-[20px] border border-border bg-card p-6 shadow-sm md:p-7">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {t("brand")}
          </Link>
        </p>
      </div>
    </div>
  );
}
