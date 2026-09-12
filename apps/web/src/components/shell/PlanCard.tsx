import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Sidebar plan/usage slot (§9). Real plan + usage arrive with entitlements
 * (§17) and billing (Step 7) — until then show the free label only,
 * NEVER fake quota numbers (spec §7.2, CLAUDE.md §29).
 */
export function PlanCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("plan.currentPlan")}</span>
          <Badge>{t("plan.free")}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("plan.usageUnavailable")}</p>
      </CardContent>
    </Card>
  );
}
