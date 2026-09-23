import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { Languages, Monitor, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Native language names are locale-invariant proper nouns (documented
// exception, same as the brand name).
const NATIVE_LOCALE: Record<string, string> = { en: "English", tr: "Türkçe" };

/** One labeled preference row inside a settings panel. */
function SettingRow({
  icon,
  label,
  description,
  control,
}: {
  icon: ReactNode;
  label: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex-none">{control}</div>
    </div>
  );
}

/** Settings (§9): appearance, language and account — reuses the shell toggles. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { locale = "en" } = useParams();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          {t("settings.title")}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <Card className="rounded-[20px] border-border/80">
        <CardContent className="divide-y divide-border p-6">
          <SettingRow
            icon={<Monitor className="size-4" aria-hidden="true" />}
            label={t("settings.appearance")}
            description={t("settings.appearanceDescription")}
            control={<ThemeToggle />}
          />
          <SettingRow
            icon={<Languages className="size-4" aria-hidden="true" />}
            label={t("language.label")}
            description={NATIVE_LOCALE[locale] ?? "English"}
            control={<LanguageSwitcher />}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border-border/80">
        <CardContent className="flex items-center gap-4 p-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
            <User className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("settings.account")}</p>
            {user ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                <Badge>{t("plan.free")}</Badge>
              </div>
            ) : (
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {t("settings.accountDescription")}
              </p>
            )}
          </div>
          {user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-none"
              onClick={() => {
                void logout().then(() => navigate(`/${locale}`));
              }}
            >
              {t("plan.logout")}
            </Button>
          ) : loading ? (
            <div
              className="h-9 w-28 flex-none animate-pulse rounded-md bg-muted"
              aria-hidden="true"
            />
          ) : (
            <div className="flex flex-none items-center gap-2">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to={`/${locale}/auth/login`}>{t("plan.login")}</Link>
              </Button>
              <Button type="button" size="sm" asChild>
                <Link to={`/${locale}/auth/register`}>{t("plan.createAccount")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
