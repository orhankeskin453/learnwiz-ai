import type { RouteObject } from "react-router";
import { LocaleGate } from "@/components/routing/LocaleGate";
import { LocaleRedirect } from "@/components/routing/LocaleRedirect";
import { AppShell } from "@/components/shell/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { StyleGuidePage } from "@/pages/StyleGuidePage";
import { TutorPage } from "@/pages/TutorPage";
import { LearnPage } from "@/pages/LearnPage";
import { PracticePage } from "@/pages/PracticePage";
import { QuizPage } from "@/pages/QuizPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";

/** Locale-prefixed route tree (CLAUDE.md §31). */
export const routes: RouteObject[] = [
  { path: "/", element: <LocaleRedirect /> },
  {
    path: "/:locale",
    element: <LocaleGate />,
    children: [
      {
        // Auth pages render OUTSIDE the app shell (spec D1: funnel focus).
        path: "auth",
        children: [
          { path: "register", element: <RegisterPage /> },
          { path: "login", element: <LoginPage /> },
          { path: "verify", element: <VerifyEmailPage /> },
          { path: "forgot-password", element: <ForgotPasswordPage /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage section="dashboard" /> },
          { path: "tutor", element: <TutorPage /> },
          { path: "learn", element: <LearnPage /> },
          { path: "practice", element: <PracticePage /> },
          { path: "quizzes", element: <QuizPage /> },
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
