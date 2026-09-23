import "@/i18n";
import { configure, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "@/auth/AuthProvider";

// CI runs packages in parallel; give async queries headroom so a loaded runner
// cannot turn a passing assertion into a timeout flake.
configure({ asyncUtilTimeout: 4000 });

// Programmatic navigate() crashes in jsdom + node:undici (AbortSignal realm
// mismatch) — the sanctioned pattern from the routing/tutor/auth suites.
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const USER = {
  id: "u".repeat(32),
  email: "ada@example.com",
  locale: "en" as const,
  status: "active" as const,
  emailVerified: true,
  createdAt: "2026-09-23T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Render with the AuthProvider so /api/auth/me drives the account panel. */
function renderAt(path: string, meResponse: () => Response = () => jsonResponse(null, 401)) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    if (url === "/api/auth/me") return Promise.resolve(meResponse());
    if (url === "/api/auth/logout") return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  );
  return fetchMock;
}

/**
 * Scope queries to the settings panel: the shell sidebar also renders a theme
 * toggle and language switcher, so unscoped role queries are ambiguous.
 */
function content() {
  const main = document.getElementById("content");
  if (!main) throw new Error("app shell content region not found");
  return within(main);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  navigateSpy.mockClear();
});

describe("SettingsPage", () => {
  it("renders the appearance and language controls", async () => {
    renderAt("/en/settings");
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(content().getByText("System, light or dark")).toBeInTheDocument();
    // Shell toggles are reused rather than reimplemented.
    expect(content().getByRole("button", { name: "Theme" })).toBeInTheDocument();
    expect(content().getByRole("button", { name: /Switch language/i })).toBeInTheDocument();
  });

  it("shows the sign-in calls to action for guests", async () => {
    renderAt("/en/settings");
    await screen.findByRole("heading", { name: "Settings" });
    expect(content().getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/en/auth/login",
    );
    expect(content().getByRole("link", { name: "Create free account" })).toHaveAttribute(
      "href",
      "/en/auth/register",
    );
  });

  it("shows the signed-in email and a logout action when authenticated", async () => {
    renderAt("/en/settings", () => jsonResponse(USER));
    expect(await content().findByText("ada@example.com")).toBeInTheDocument();
    expect(content().getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(content().queryByRole("link", { name: "Create free account" })).not.toBeInTheDocument();
  });

  it("logs out and falls back to the guest account panel", async () => {
    renderAt("/en/settings", () => jsonResponse(USER));
    await userEvent.click(await content().findByRole("button", { name: "Log out" }));
    expect(await content().findByRole("link", { name: "Create free account" })).toBeInTheDocument();
    // Logout returns the learner to their locale dashboard.
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/en"));
  });

  it("still signs out locally when the logout request fails (no unhandled rejection)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url === "/api/auth/me") return Promise.resolve(jsonResponse(USER));
      if (url === "/api/auth/logout")
        return Promise.resolve(jsonResponse({ error: "internal_error" }, 500));
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createMemoryRouter(routes, { initialEntries: ["/en/settings"] });
    render(
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>,
    );

    await userEvent.click(await content().findByRole("button", { name: "Log out" }));
    expect(await content().findByRole("link", { name: "Create free account" })).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith("logout_request_failed", expect.any(String));
    warn.mockRestore();
  });

  it("renders localized copy on /tr with locale-prefixed auth links", async () => {
    renderAt("/tr/settings");
    expect(await screen.findByRole("heading", { name: "Ayarlar" })).toBeInTheDocument();
    expect(content().getByText("Türkçe")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("tr");
    expect(content().getByRole("link", { name: "Giriş yap" })).toHaveAttribute(
      "href",
      "/tr/auth/login",
    );
  });
});
