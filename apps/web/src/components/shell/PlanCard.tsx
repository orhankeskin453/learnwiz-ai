import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";

/**
 * Sidebar plan/usage slot (§9). Identity-aware since Step 4b: signed-in users
 * see their account + logout; guests get the conversion CTA (§29). Real usage
 * numbers arrive with entitlements (§17) — NEVER fake quotas (spec §7.2).
 */
export function PlanCard() {
  const { t } = useTranslation();
  const { locale = "en" } = useParams();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  return (
    <Card>
      <CardContent className="p-4 text-sm">
        {user ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("plan.signedInAs")}</span>
              <Badge>{t("plan.free")}</Badge>
            </div>
            <p className="mt-2 truncate text-xs font-medium text-foreground" title={user.email}>
              {user.email}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                void logout().then(() => navigate(`/`));
              }}
            >
              {t("plan.logout")}
            </Button>
          </>
        ) : loading ? (
          <p className="text-muted-foreground">{t("plan.currentPlan")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("plan.currentPlan")}</span>
              <Badge>{t("plan.free")}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("plan.usageUnavailable")}</p>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" className="flex-1" asChild>
                <Link to={`/${locale}/auth/register`}>{t("plan.createAccount")}</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to={`/${locale}/auth/login`}>{t("plan.login")}</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
