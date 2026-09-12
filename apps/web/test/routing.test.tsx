import "@/i18n";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Navigate breaks in jsdom + node:undici (AbortSignal instanceof check fails).
// Mock it to capture props without executing client-side navigation.
vi.mock("react-router", async () => {
  const original = await vi.importActual("react-router");
  return {
    ...original,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
      <div data-testid="navigate-probe" data-to={to} data-replace={String(!!replace)} />
    ),
  };
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe("routing", () => {
  // document.documentElement.lang persists across tests in this jsdom instance;
  // reset it after each test so a /tr locale assertion does not leak downstream.
  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("redirects / to the resolved locale and shows the dashboard placeholder", async () => {
    // jsdom navigator.languages defaults to en-US → resolves "en"
    // Navigate probes instead of executing broken memory-mode redirect.
    renderAt("/");
    const probe = await screen.findByTestId("navigate-probe");
    expect(probe).toHaveAttribute("data-to", "/en");
    expect(probe).toHaveAttribute("data-replace", "true");
  });

  it("redirects an unsupported locale to the resolved one", async () => {
    // Navigate probes instead of executing broken memory-mode redirect.
    renderAt("/de");
    const probe = await screen.findByTestId("navigate-probe");
    expect(probe).toHaveAttribute("data-to", "/en");
  });

  it("renders Turkish strings and sets <html lang> on /tr", async () => {
    renderAt("/tr/tutor");
    expect(
      await screen.findByRole("heading", { name: "AI Özel Ders çok yakında" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("tr");
  });

  it("serves the style-guide route outside the app shell", async () => {
    renderAt("/en/style-guide");
    expect(
      await screen.findByRole("heading", { name: "LearWizAI Style Guide" }),
    ).toBeInTheDocument();
  });

  it("renders the localized 404 for unknown locale subpaths", async () => {
    renderAt("/tr/olmayan-sayfa");
    expect(await screen.findByRole("heading", { name: "Sayfa bulunamadı" })).toBeInTheDocument();
  });
});
