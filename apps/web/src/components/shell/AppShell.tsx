import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";

/** Application frame per CLAUDE.md §9: desktop sidebar + mobile bottom nav. */
export function AppShell() {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          {t("aria.skipToContent")}
        </a>
        <SidebarNav />
        <main id="content" className="md:pl-60">
          {/* pb-24 keeps content clear of the mobile bottom nav */}
          <div className="mx-auto max-w-5xl p-4 pb-24 md:p-8 md:pb-8">
            <Outlet />
          </div>
        </main>
        <BottomNav />
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  );
}
