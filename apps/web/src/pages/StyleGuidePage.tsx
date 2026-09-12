import { Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Token names and variant names are code identifiers — shown verbatim, not translated.
const SWATCHES = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "primary", className: "bg-primary" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "accent", className: "bg-accent" },
  { name: "card", className: "bg-card" },
  { name: "destructive", className: "bg-destructive" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "info", className: "bg-info" },
  { name: "border", className: "bg-border" },
] as const;

const BUTTON_VARIANTS = ["default", "secondary", "outline", "ghost", "destructive"] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6">
      <h2 id={`${id}-heading`} className="mb-3 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="rounded-lg border border-border bg-card p-5">{children}</div>
    </section>
  );
}

/** Design-system showcase — the standing §40.7 visual-QA surface. */
export function StyleGuidePage() {
  const { t } = useTranslation("styleguide");
  const [progress, setProgress] = useState(40);

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Section id="theme" title={t("sections.theme")}>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <p className="text-sm text-muted-foreground">{t("demo.themeNote")}</p>
        </div>
      </Section>

      <Section id="tokens" title={t("sections.tokens")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name} className="flex items-center gap-2">
              <span
                className={cn("size-8 rounded-md border border-border", swatch.className)}
                aria-hidden="true"
              />
              <code className="text-xs text-muted-foreground">{swatch.name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section id="typography" title={t("sections.typography")}>
        <div className="space-y-2">
          <p className="text-3xl font-semibold text-foreground">Heading — 30px / 600</p>
          <p className="text-xl font-semibold text-foreground">Heading — 20px / 600</p>
          <p className="text-base font-medium text-foreground">Body — 16px / 500</p>
          <p className="text-sm text-muted-foreground">Secondary — 14px / muted-foreground</p>
        </div>
      </Section>

      <Section id="radius" title={t("sections.radius")}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="size-16 rounded-sm bg-primary/20 ring-1 ring-primary" title="sm — 6px" />
          <div className="size-16 rounded-md bg-primary/20 ring-1 ring-primary" title="md — 10px" />
          <div className="size-16 rounded-lg bg-primary/20 ring-1 ring-primary" title="lg — 14px" />
          <div className="size-16 rounded-xl bg-primary/20 ring-1 ring-primary" title="xl — 18px" />
          <div className="size-16 rounded-full bg-primary/20 ring-1 ring-primary" title="full" />
          <div className="rounded-md border border-border p-3 shadow-sm">
            <code className="text-xs text-muted-foreground">shadow-sm</code>
          </div>
        </div>
      </Section>

      <Section id="buttons" title={t("sections.buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              <code>{variant}</code>
            </Button>
          ))}
          <Button disabled>
            <code>disabled</code>
          </Button>
          <Button size="sm">
            <code>sm</code>
          </Button>
          <Button size="lg">
            <code>lg</code>
          </Button>
          <Button size="icon" aria-label={t("demo.iconButtonLabel")}>
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section id="forms" title={t("sections.forms")}>
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sg-email">{t("demo.inputLabel")}</Label>
            <Input id="sg-email" type="email" placeholder={t("demo.inputPlaceholder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-textarea">Textarea</Label>
            <Textarea id="sg-textarea" placeholder={t("demo.textareaPlaceholder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-select">Select</Label>
            <Select>
              <SelectTrigger id="sg-select" className="w-56">
                <SelectValue placeholder={t("demo.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">{t("demo.optionA")}</SelectItem>
                <SelectItem value="b">{t("demo.optionB")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section id="cards" title={t("sections.cards")}>
        <div className="flex flex-wrap items-start gap-4">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>{t("demo.sampleTitle")}</CardTitle>
              <CardDescription>{t("demo.sampleDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge>default</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="outline">outline</Badge>
                <Badge variant="success">success</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="error">error</Badge>
                <Badge variant="info">info</Badge>
              </div>
            </CardContent>
          </Card>
          <Separator orientation="vertical" className="h-24" />
          <div className="space-y-2">
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <code className="text-xs text-muted-foreground">Avatar</code>
          </div>
        </div>
      </Section>

      <Section id="overlays" title={t("sections.overlays")}>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("demo.dialogTitle")}</DialogTitle>
                <DialogDescription>{t("demo.dialogDescription")}</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{t("demo.sheetTitle")}</SheetTitle>
                <SheetDescription>{t("demo.sheetDescription")}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{t("demo.menu")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>{t("demo.menuItem")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Style-guide route renders outside the AppShell TooltipProvider. */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>{t("demo.tooltip")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Section>

      <Section id="tabs" title={t("sections.tabs")}>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">{t("demo.tabA")}</TabsTrigger>
            <TabsTrigger value="b">{t("demo.tabB")}</TabsTrigger>
          </TabsList>
          <TabsContent value="a">
            <p className="text-sm text-muted-foreground">{t("demo.tabA")}</p>
          </TabsContent>
          <TabsContent value="b">
            <p className="text-sm text-muted-foreground">{t("demo.tabB")}</p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section id="feedback" title={t("sections.feedback")}>
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              toast(t("demo.toast"));
            }}
          >
            Toast
          </Button>
          <div className="flex max-w-md items-center gap-3">
            <Progress value={progress} aria-label={t("demo.progressLabel")} className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProgress((value) => (value >= 100 ? 0 : value + 20));
              }}
            >
              {t("demo.increaseProgress")}
            </Button>
          </div>
          <div className="max-w-md space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Section>

      <Section id="states" title={t("sections.states")}>
        <div className="grid gap-4">
          <EmptyState title={t("demo.emptyTitle")} description={t("demo.emptyDescription")} />
          <LoadingState />
          <ErrorState
            onRetry={() => {
              toast(t("demo.retryFired"));
            }}
          />
        </div>
      </Section>
    </main>
  );
}
