import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError } from "@/services/apiClient";
import { login, resendVerification } from "@/services/auth";

type LoginError =
  | { kind: "invalidCredentials" }
  | { kind: "notVerified" }
  | { kind: "suspended" }
  | { kind: "generic" };

/** Login (§10.9): state-aware — unverified and suspended accounts get distinct copy. */
export function LoginPage() {
  const { t } = useTranslation("auth");
  const { locale } = useParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [resent, setResent] = useState(false);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setResent(false);
    try {
      const response = await login(email.trim(), password);
      setUser(response.user);
      // D8 (amended): SPA navigation remounts pages, refetching per-identity state.
      navigate(`/${locale}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "email_not_verified") setError({ kind: "notVerified" });
        else if (err.code === "account_suspended") setError({ kind: "suspended" });
        else if (err.code === "invalid_credentials") setError({ kind: "invalidCredentials" });
        else setError({ kind: "generic" });
      } else {
        setError({ kind: "generic" });
      }
      setSending(false);
    }
  }

  async function resend(): Promise<void> {
    setResent(true);
    await resendVerification(email.trim()).catch(() => undefined);
  }

  return (
    <AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{t("login.emailLabel")}</Label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("register.emailPlaceholder")}
            autoComplete="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">{t("login.passwordLabel")}</Label>
          <Input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error?.kind === "invalidCredentials" && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.invalidCredentials")}
          </p>
        )}
        {error?.kind === "suspended" && (
          <p role="alert" className="text-sm text-destructive">
            {t("login.suspended")}
          </p>
        )}
        {error?.kind === "notVerified" && (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
          >
            <p>{t("login.notVerified")}</p>
            {resent ? (
              <p className="text-success">{t("login.resent")}</p>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={resend}>
                {t("login.resend")}
              </Button>
            )}
          </div>
        )}
        {error?.kind === "generic" && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.generic")}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link
          to={`/${locale}/auth/forgot-password`}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("login.forgot")}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link to={`/${locale}/auth/register`} className="text-primary hover:underline">
          {t("login.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
}
