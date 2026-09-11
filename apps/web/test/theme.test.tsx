import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function Probe() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setMode("dark")}>
        to-dark
      </button>
      <button type="button" onClick={() => setMode("system")}>
        to-system
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("defaults to system mode and applies the resolved theme to <html>", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
    // setup.ts mocks matchMedia with matches:false → system resolves to light
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setMode('dark') persists to localStorage and adds .dark", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("learwiz_theme")).toBe("dark");
  });

  it("restores a stored mode on mount", () => {
    localStorage.setItem("learwiz_theme", "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    localStorage.removeItem("learwiz_theme");
    document.documentElement.classList.remove("dark");
  });

  it("throws when useTheme is used outside the provider", () => {
    // Render error is expected; silence the console noise for this case only.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useTheme must be used within ThemeProvider");
    spy.mockRestore();
  });
});
