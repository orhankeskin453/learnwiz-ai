import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { requestPasswordReset } from "@/services/auth";

/** §40.9: the response is generic whether or not the account exists. */
export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const { locale } = useParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (sending || !email.trim()) return;
    setSending(true);
    await requestPasswordReset(email.trim()).catch(() => undefined);
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthLayout title={t("forgot.sentTitle")}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>{t("forgot.sentBody", { email: sentTo })}</p>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to={`/${locale}/auth/login`}>{t("forgot.backToLogin")}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="forgot-email">{t("forgot.emailLabel")}</Label>
          <Input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("register.emailPlaceholder")}
            autoComplete="email"
          />
        </div>
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? t("forgot.submitting") : t("forgot.submit")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to={`/${locale}/auth/login`} className="text-muted-foreground hover:text-foreground">
          {t("forgot.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
