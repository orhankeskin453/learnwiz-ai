import "@/i18n";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TOPICS = {
  topics: [
    { topic: "Hücre biyolojisi", mastery: 0.6, totalQuestions: 5, correctQuestions: 3 },
    { topic: "Fotosentez", mastery: 0.9, totalQuestions: 10, correctQuestions: 9 },
  ],
};

function renderAt(path: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url === "/api/dashboard/progress") return Promise.resolve(jsonResponse(TOPICS));
      if (url === "/api/auth/me") return Promise.resolve(jsonResponse(null, 401));
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ProgressPage", () => {
  it("shows per-topic mastery and the correct/total breakdown", async () => {
    renderAt("/tr/progress");
    expect(await screen.findByText("Hücre biyolojisi")).toBeInTheDocument();
    expect(screen.getByText("%60 hakimiyet")).toBeInTheDocument();
    expect(screen.getByText("5 sorunun 3 tanesi doğru")).toBeInTheDocument();
  });

  it("links weak topics to an ABSOLUTE locale-prefixed practice URL", async () => {
    renderAt("/tr/progress");
    const link = await screen.findByRole("link", { name: "Hücre biyolojisi alıştırması yap" });
    // Regression: a relative "practice?topic=…" resolved to /tr/progress/practice (404).
    expect(link).toHaveAttribute("href", "/tr/practice?topic=H%C3%BCcre%20biyolojisi");
  });

  it("lists only weak topics (<80% mastery) under needs-practice", async () => {
    renderAt("/tr/progress");
    await screen.findByText("Hücre biyolojisi");
    expect(
      screen.getByRole("link", { name: "Hücre biyolojisi alıştırması yap" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Fotosentez alıştırması yap" }),
    ).not.toBeInTheDocument();
  });
});
