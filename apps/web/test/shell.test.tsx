import "@/i18n";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Programmatic navigate() crashes in jsdom + node:undici (AbortSignal realm
// mismatch — same root cause as the routing suite's Navigate mock). Capture
// the navigation target without executing the client-side redirect.
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async () => {
  const original = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...original,
    useNavigate: () => navigateSpy,
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

describe("AppShell", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    navigateSpy.mockClear();
    // jsdom shares cookies across tests in a file — clear the locale cookie.
    document.cookie = "learwiz_locale=;path=/;max-age=0";
  });

  it("renders the sidebar with English labels and marks the active route", async () => {
    renderAt("/en");
    const sidebar = await screen.findByRole("complementary");
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("link", { name: "AI Tutor" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Documents" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders Turkish labels on /tr", async () => {
    renderAt("/tr");
    const sidebar = await screen.findByRole("complementary");
    expect(within(sidebar).getByRole("link", { name: "Panel" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "AI Özel Ders" })).toBeInTheDocument();
  });

  it("renders the mobile bottom nav landmark", async () => {
    renderAt("/en");
    await screen.findByRole("complementary");
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
  });

  it("language switcher persists the choice and swaps the route locale", async () => {
    const user = userEvent.setup();
    renderAt("/en/tutor");
    // Regex match: the aria-label interpolates the NEXT locale's native name.
    await user.click(await screen.findByRole("button", { name: /Switch language/i }));
    // The component's contract: persist the choice, then swap the /:locale
    // segment of the current route (deep path + search preserved).
    expect(document.cookie).toContain("learwiz_locale=tr");
    expect(navigateSpy).toHaveBeenCalledWith("/tr/tutor");
  });

  it("theme toggle applies dark mode and persists it", async () => {
    const user = userEvent.setup();
    renderAt("/en");
    await user.click(await screen.findByRole("button", { name: "Theme" }));
    await user.click(await screen.findByRole("menuitem", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("learwiz_theme")).toBe("dark");
  });

  it("shell has no axe violations", async () => {
    const { baseElement } = renderAt("/en");
    await screen.findByRole("complementary");
    await expect(await axe(baseElement)).toHaveNoViolations();
  });
});
