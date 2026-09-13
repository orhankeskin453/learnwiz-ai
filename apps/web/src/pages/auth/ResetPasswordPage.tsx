import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ApiError } from "@/services/apiClient";
import { resetPassword } from "@/services/auth";

type ResetState = "form" | "success" | "invalid";

/** Password reset confirm (§47.7): token from the email link. */
export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const { locale } = useParams();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ResetState>("form");

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (sending) return;
    if (password.length < 10) {
      setError(t("errors.validation"));
      return;
    }
    const token = searchParams.get("token") ?? "";
    setSending(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setState("success");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_token") {
        setState("invalid");
      } else {
        setError(t("errors.generic"));
      }
    } finally {
      setSending(false);
    }
  }

  if (state === "success") {
    return (
      <AuthLayout title={t("reset.successTitle")}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>{t("reset.successBody")}</p>
          <Button type="button" className="w-full" asChild>
            <Link to={`/${locale}/auth/login`}>{t("reset.goLogin")}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (state === "invalid") {
    return (
      <AuthLayout title={t("reset.invalidTitle")}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>{t("reset.invalidBody")}</p>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to={`/${locale}/auth/forgot-password`}>{t("login.forgot")}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("reset.title")} subtitle={t("reset.subtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="reset-password">{t("reset.passwordLabel")}</Label>
          <Input
            id="reset-password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{t("reset.passwordHint")}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? t("reset.submitting") : t("reset.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
