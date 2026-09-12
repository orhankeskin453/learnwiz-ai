import {
  BookOpen,
  FileText,
  LayoutDashboard,
  ListChecks,
  PencilLine,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PlanCard } from "./PlanCard";
import { ThemeToggle } from "./ThemeToggle";

type NavSection =
  "dashboard" | "tutor" | "learn" | "practice" | "quizzes" | "documents" | "progress" | "settings";

interface NavEntry {
  section: NavSection;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

// §9 navigation order: primary group, Progress, Settings.
const PRIMARY_NAV: NavEntry[] = [
  { section: "dashboard", to: "", icon: LayoutDashboard, end: true },
  { section: "tutor", to: "tutor", icon: Sparkles },
  { section: "learn", to: "learn", icon: BookOpen },
  { section: "practice", to: "practice", icon: PencilLine },
  { section: "quizzes", to: "quizzes", icon: ListChecks },
  { section: "documents", to: "documents", icon: FileText },
];
const SECONDARY_NAV: NavEntry[] = [{ section: "progress", to: "progress", icon: TrendingUp }];
const TERTIARY_NAV: NavEntry[] = [{ section: "settings", to: "settings", icon: Settings }];

function SidebarLink({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation("nav");
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring",
          isActive && "bg-accent text-accent-foreground",
        )
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(`items.${entry.section}`)}
    </NavLink>
  );
}

export function SidebarNav() {
  const { t } = useTranslation("nav");
  // Typed keys (Task 2) scope t() to the nav namespace — aria labels come
  // from common via a second hook instead of a "common:" cross-ns key.
  const { t: tCommon } = useTranslation("common");
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-14 items-center px-4">
        {/* Brand name is a proper noun — not translated (documented exception). */}
        <span className="text-base font-semibold text-foreground">{t("brand")}</span>
      </div>
      <nav
        aria-label={tCommon("aria.mainNavigation")}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
      >
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map((entry) => (
            <SidebarLink key={entry.section} entry={entry} />
          ))}
        </div>
        <Separator className="my-2" />
        {SECONDARY_NAV.map((entry) => (
          <SidebarLink key={entry.section} entry={entry} />
        ))}
        <Separator className="my-2" />
        {TERTIARY_NAV.map((entry) => (
          <SidebarLink key={entry.section} entry={entry} />
        ))}
      </nav>
      <div className="space-y-3 border-t border-border p-3">
        <PlanCard />
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </aside>
  );
}
