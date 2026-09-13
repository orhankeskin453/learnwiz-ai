import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ApiError } from "@/services/apiClient";
import { register, resendVerification } from "@/services/auth";

/** Register (§10.9): pending account + verification email → check-email screen. */
export function RegisterPage() {
  const { t } = useTranslation("auth");
  const { locale } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (sending) return;
    if (password.length < 10) {
      setError(t("errors.validation"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await register(email.trim(), password);
      setSentTo(email.trim());
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "validation_error"
          ? t("errors.validation")
          : t("errors.generic"),
      );
    } finally {
      setSending(false);
    }
  }

  async function resend(): Promise<void> {
    if (!sentTo) return;
    setResent(true);
    await resendVerification(sentTo).catch(() => undefined);
  }

  if (sentTo) {
    return (
      <AuthLayout title={t("register.checkEmailTitle")}>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{t("register.checkEmailBody", { email: sentTo })}</p>
          {resent ? (
            <p className="text-success">{t("register.resent")}</p>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={resend}>
              {t("register.resend")}
            </Button>
          )}
          <p>
            <Link to={`/${locale}/auth/login`} className="text-sm text-primary hover:underline">
              {t("register.loginLink")}
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">{t("register.emailLabel")}</Label>
          <Input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("register.emailPlaceholder")}
            autoComplete="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">{t("register.passwordLabel")}</Label>
          <Input
            id="register-password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{t("register.passwordHint")}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link to={`/${locale}/auth/login`} className="text-primary hover:underline">
          {t("register.loginLink")}
        </Link>
      </p>
    </AuthLayout>
  );
}
