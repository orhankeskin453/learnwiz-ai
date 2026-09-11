import type { RouteObject } from "react-router";
import { LocaleGate } from "@/components/routing/LocaleGate";
import { LocaleRedirect } from "@/components/routing/LocaleRedirect";
import { AppShell } from "@/components/shell/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { StyleGuidePage } from "@/pages/StyleGuidePage";

/** Locale-prefixed route tree (CLAUDE.md -31). */
export const routes: RouteObject[] = [
  { path: "/", element: <LocaleRedirect /> },
  {
    path: "/:locale",
    element: <LocaleGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage section="dashboard" /> },
          { path: "tutor", element: <PlaceholderPage section="tutor" /> },
          { path: "learn", element: <PlaceholderPage section="learn" /> },
          { path: "practice", element: <PlaceholderPage section="practice" /> },
          { path: "quizzes", element: <PlaceholderPage section="quizzes" /> },
          { path: "documents", element: <PlaceholderPage section="documents" /> },
          { path: "progress", element: <PlaceholderPage section="progress" /> },
          { path: "settings", element: <PlaceholderPage section="settings" /> },
        ],
      },
      { path: "style-guide", element: <StyleGuidePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];
