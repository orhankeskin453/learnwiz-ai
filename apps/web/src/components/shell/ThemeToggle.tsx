import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";

const MODES = [
  { mode: "system", icon: Monitor, labelKey: "theme.system" },
  { mode: "light", icon: Sun, labelKey: "theme.light" },
  { mode: "dark", icon: Moon, labelKey: "theme.dark" },
] as const satisfies readonly { mode: ThemeMode; icon: LucideIcon; labelKey: string }[];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("theme.label")}>
          <Sun className="size-4 dark:hidden" aria-hidden="true" />
          <Moon className="hidden size-4 dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {MODES.map(({ mode: value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setMode(value)}
            className={cn(mode === value && "bg-accent text-accent-foreground")}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
