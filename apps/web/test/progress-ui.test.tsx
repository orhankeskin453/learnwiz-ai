import "@/i18n";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { GenerationProgress } from "@/components/learning/GenerationProgress";

function renderAt(path: string) {
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

afterEach(() => {
  // Fake timers must never leak into the next test file/test.
  vi.useRealTimers();
});

describe("GenerationProgress", () => {
  it("shows the first stage and an elapsed counter while generating", async () => {
    render(<GenerationProgress stages={["Stage one", "Stage two"]} />);
    expect(screen.getByText("Stage one")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Elapsed counter starts at zero seconds.
    expect(screen.getByText("0s elapsed")).toBeInTheDocument();
  });

  it("advances to the next stage after the interval", async () => {
    vi.useFakeTimers();
    render(<GenerationProgress stages={["Stage one", "Stage two"]} intervalMs={500} />);
    expect(screen.getByText("Stage one")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText("Stage two")).toBeInTheDocument();
  });
});

describe("LearnPage staged feedback", () => {
  it("shows staged progress copy while the lesson is being generated", async () => {
    // Never-resolving fetch keeps the page in its loading state.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    renderAt("/en/learn");

    await userEvent.type(await screen.findByLabelText(/What do you want to learn/i), "Gravity");
    await userEvent.click(screen.getByRole("button", { name: "Create my lesson" }));

    expect(await screen.findByText("Reading your topic…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("QuizPage staged feedback", () => {
  it("mentions parallel batches while generating a quiz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    renderAt("/en/quizzes");

    await userEvent.type(await screen.findByLabelText(/Quiz topic/i), "Gravity");
    await userEvent.click(screen.getByRole("button", { name: "Generate quiz" }));

    expect(await screen.findByText("Reading your topic…")).toBeInTheDocument();
  });
});
