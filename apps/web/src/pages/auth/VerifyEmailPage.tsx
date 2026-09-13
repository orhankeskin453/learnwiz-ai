import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/auth/AuthProvider";
import { verifyEmail } from "@/services/auth";

type VerifyState = "verifying" | "success" | "invalid";

/** Email-link landing (§47.3): the token IS the action — auto-submits on mount. */
export function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const { locale } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [state, setState] = useState<VerifyState>("verifying");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = searchParams.get("token");
    if (!token) {
      setState("invalid");
      return;
    }
    void (async () => {
      try {
        const response = await verifyEmail(token);
        setUser(response.user);
        setState("success");
      } catch {
        setState("invalid");
      }
    })();
  }, [searchParams, setUser]);

  return (
    <AuthLayout
      title={
        state === "success"
          ? t("verify.successTitle")
          : state === "invalid"
            ? t("verify.invalidTitle")
            : t("verify.verifying")
      }
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        {state === "verifying" && (
          <p aria-live="polite" className="animate-pulse">
            {t("verify.verifying")}
          </p>
        )}
        {state === "success" && (
          <>
            <p>{t("verify.successBody")}</p>
            <Button
              type="button"
              className="w-full"
              onClick={() => window.location.assign(`/${locale}`)}
            >
              {t("verify.continue")}
            </Button>
          </>
        )}
        {state === "invalid" && (
          <>
            <p>{t("verify.invalidBody")}</p>
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link to={`/${locale}/auth/login`}>{t("verify.goLogin")}</Link>
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
