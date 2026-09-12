import { FileText, ListChecks, MoreHorizontal, Settings, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const MORE_ITEMS = [
  { section: "quizzes", to: "quizzes", icon: ListChecks },
  { section: "documents", to: "documents", icon: FileText },
  { section: "progress", to: "progress", icon: TrendingUp },
  { section: "settings", to: "settings", icon: Settings },
] as const;

export function MoreSheet() {
  const { t } = useTranslation("nav");
  // Typed keys (Task 2) scope t() to the nav namespace — aria labels come
  // from common via a second hook instead of a "common:" cross-ns key.
  const { t: tCommon } = useTranslation("common");
  return (
    <Sheet>
      <SheetTrigger
        className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={tCommon("aria.moreMenu")}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
        {t("mobile.more")}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{tCommon("aria.moreMenu")}</SheetTitle>
          <SheetDescription className="sr-only">{tCommon("aria.moreMenu")}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-2" aria-label={tCommon("aria.moreMenu")}>
          {MORE_ITEMS.map(({ section, to, icon: Icon }) => (
            <SheetClose asChild key={section}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`items.${section}`)}
              </NavLink>
            </SheetClose>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
