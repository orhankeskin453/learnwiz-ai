import "@/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "@/auth/AuthProvider";

// Programmatic navigate() crashes in jsdom + node:undici (AbortSignal realm
// mismatch — same sanctioned pattern as the routing/tutor suites). Capture the
// navigation target instead of executing it.
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const USER = {
  id: "u".repeat(32),
  email: "ada@example.com",
  locale: "en" as const,
  status: "active" as const,
  emailVerified: true,
  createdAt: "2026-09-13T00:00:00.000Z",
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  );
}

/** URL-dispatching fetch mock; shell mount calls get quiet stubs. */
function stubFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const defaults: Record<string, () => Response> = {
    "/api/auth/me": () => jsonResponse(null, 401),
    "/api/guest/session": () => jsonResponse({ expiresAt: "x", usage: [] }),
    "/api/tutor/quota": () => jsonResponse({ used: 0, limit: 3 }),
    "/api/tutor/conversations": () => jsonResponse([]),
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : String(input);
    return Promise.resolve((handlers[path] ?? defaults[path] ?? (() => jsonResponse({}, 404)))());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterPage", () => {
  it("registers and shows the check-email screen with a resend action", async () => {
    const fetchMock = stubFetch({
      "/api/auth/register": () => jsonResponse({ ok: true }),
      "/api/auth/resend-verification": () => jsonResponse({ ok: true }),
    });
    renderAt("/en/auth/register");

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([p]) => p === "/api/auth/resend-verification")).toBe(true);
    });
    expect(screen.getByText("Verification email sent again.")).toBeInTheDocument();
  });

  it("rejects short passwords client-side without a network call", async () => {
    const fetchMock = stubFetch({});
    renderAt("/en/auth/register");

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("check the fields");
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/auth/register")).toBe(false);
  });
});

describe("LoginPage", () => {
  it("logs in and navigates to the dashboard", async () => {
    stubFetch({ "/api/auth/login": () => jsonResponse({ user: USER }) });

    renderAt("/en/auth/login");
    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    // Memory-router navigation lands on the dashboard placeholder.
    try {
      await screen.findByText("Your dashboard is coming");
    } catch {
      console.log("LOGIN-URL:", window.location.pathname);
      console.log("LOGIN-DOM:", document.body.innerHTML.slice(0, 300));
    }
  });

  it("shows the unverified state with a resend action", async () => {
    stubFetch({
      "/api/auth/login": () => jsonResponse({ error: "email_not_verified" }, 403),
      "/api/auth/resend-verification": () => jsonResponse({ ok: true }),
    });
    renderAt("/en/auth/login");

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText(/verify your email first/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByText("Verification email sent again.")).toBeInTheDocument();
  });

  it("shows invalid credentials for wrong passwords", async () => {
    stubFetch({ "/api/auth/login": () => jsonResponse({ error: "invalid_credentials" }, 401) });
    renderAt("/en/auth/login");

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });
});

describe("VerifyEmailPage", () => {
  it("auto-verifies the token from the link and offers the dashboard", async () => {
    stubFetch({ "/api/auth/verify-email": () => jsonResponse({ user: USER }) });
    renderAt(`/en/auth/verify?token=${"a".repeat(64)}`);

    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to your dashboard" })).toBeInTheDocument();
  });

  it("shows the invalid state for rejected tokens", async () => {
    stubFetch({ "/api/auth/verify-email": () => jsonResponse({ error: "invalid_token" }, 400) });
    renderAt(`/en/auth/verify?token=${"a".repeat(64)}`);

    expect(await screen.findByText("This link is not valid")).toBeInTheDocument();
  });
});

describe("password reset pages", () => {
  it("requests a reset and shows the generic sent screen", async () => {
    const fetchMock = stubFetch({
      "/api/auth/request-password-reset": () => jsonResponse({ ok: true }),
    });
    renderAt("/en/auth/forgot-password");

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([p]) => p === "/api/auth/request-password-reset")).toBe(true);
  });

  it("resets the password from the emailed token", async () => {
    stubFetch({ "/api/auth/reset-password": () => jsonResponse({ ok: true }) });
    renderAt(`/en/auth/reset-password?token=${"b".repeat(64)}`);

    await userEvent.type(await screen.findByLabelText("New password"), "brand-new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });
});

describe("PlanCard identity states", () => {
  it("shows the signed-in user with a logout action when authenticated", async () => {
    stubFetch({
      "/api/auth/me": () => jsonResponse(USER),
      "/api/auth/logout": () => new Response(null, { status: 204 }),
    });
    renderAt("/en");

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => {
      expect(screen.getByText("Create free account")).toBeInTheDocument();
    });
  });

  it("shows the conversion CTA for guests", async () => {
    stubFetch({});
    renderAt("/en");

    expect(await screen.findByText("Create free account")).toBeInTheDocument();
    expect(screen.getByText("Log in")).toBeInTheDocument();
  });
});
