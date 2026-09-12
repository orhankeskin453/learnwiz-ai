import { BookOpen, LayoutDashboard, PencilLine, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./MoreSheet";

function BottomLink({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
          isActive && "text-primary",
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export function BottomNav() {
  const { t } = useTranslation("nav");
  // Typed keys (Task 2) scope t() to the nav namespace — aria label comes
  // from common via a second hook instead of a "common:" cross-ns key.
  const { t: tCommon } = useTranslation("common");
  return (
    <nav
      aria-label={tCommon("aria.mobileNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card md:hidden"
    >
      <BottomLink to="" end icon={LayoutDashboard} label={t("mobile.home")} />
      <BottomLink to="tutor" icon={Sparkles} label={t("items.tutor")} />
      <BottomLink to="learn" icon={BookOpen} label={t("items.learn")} />
      <BottomLink to="practice" icon={PencilLine} label={t("items.practice")} />
      <MoreSheet />
    </nav>
  );
}
