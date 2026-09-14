import { useTranslation } from "react-i18next";
import { Link } from "react-router";
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
          <Link to="/" className="text-xl font-semibold text-foreground">
            LearnWiz AI
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </header>
        <div className="rounded-lg border border-border bg-card p-6">{children}</div>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {t("brand")}
          </Link>
        </p>
      </div>
    </div>
  );
}
