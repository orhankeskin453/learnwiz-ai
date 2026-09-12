import "@/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

const LESSON_BODY = {
  lessonId: "a".repeat(32),
  lesson: {
    title: "Photosynthesis",
    blocks: [
      { kind: "concept", content: "Plants convert light into energy." },
      { kind: "intuition", content: "Leaves are solar kitchens." },
      { kind: "example", content: "A leaf produces glucose." },
      { kind: "common_mistakes", content: "Plants do not eat soil." },
      { kind: "mini_exercise", content: "List inputs and outputs." },
      {
        kind: "check_understanding",
        content: "Check yourself.",
        question: "What gas is released?",
        answer: "Oxygen.",
      },
    ],
  },
};

const QUESTIONS_BODY = {
  quizId: "b".repeat(32),
  questions: [
    {
      question: "Main input of photosynthesis?",
      options: ["Oxygen", "Light", "Sugar", "Nitrogen"],
      answer: 1,
      explanation: "Light drives the reaction.",
    },
    {
      question: "Where does it happen?",
      options: ["Roots", "Mitochondria", "Chloroplasts", "Nucleus"],
      answer: 2,
      explanation: "Chloroplasts contain chlorophyll.",
    },
    {
      question: "What gas is released?",
      options: ["CO2", "Oxygen", "Methane", "Hydrogen"],
      answer: 1,
      explanation: "Oxygen is a by-product.",
    },
  ],
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

/** Dispatch by path; mount calls (quota/conversations/guest session) get stubs. */
function stubFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const defaults: Record<string, () => Response> = {
    "/api/guest/session": () =>
      jsonResponse({
        expiresAt: "2026-09-19T00:00:00.000Z",
        usage: [],
      }),
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("LearnPage", () => {
  it("generates a lesson and shows the teaching blocks", async () => {
    stubFetch({ "/api/learn/lessons": () => jsonResponse(LESSON_BODY) });
    renderAt("/en/learn");
    await screen.findByLabelText(/What do you want to learn/i);

    await userEvent.type(screen.getByLabelText(/What do you want to learn/i), "Photosynthesis");
    await userEvent.click(screen.getByRole("button", { name: "Create my lesson" }));

    expect(await screen.findByText("Plants convert light into energy.")).toBeInTheDocument();
    expect(screen.getByText("Concept")).toBeInTheDocument();

    // Navigate to the check-understanding block and reveal the answer.
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText("What gas is released?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText("Oxygen.")).toBeInTheDocument();
  });
});

describe("PracticePage", () => {
  it("runs a practice set with instant feedback and a summary", async () => {
    stubFetch({ "/api/practice": () => jsonResponse(QUESTIONS_BODY) });
    renderAt("/en/practice");
    await screen.findByLabelText(/Topic to practice/i);

    await userEvent.type(screen.getByLabelText(/Topic to practice/i), "Photosynthesis");
    await userEvent.click(screen.getByRole("button", { name: "Start practice" }));

    // Q1: correct answer → instant feedback.
    await screen.findByText("Main input of photosynthesis?");
    fireEvent.click(await screen.findByRole("radio", { name: "Light" }));
    await userEvent.click(await screen.findByRole("button", { name: "Check answer" }));
    expect(await screen.findByText("Correct!")).toBeInTheDocument();

    // Answer remaining questions (wrongly) and finish.
    for (let i = 0; i < 2; i++) {
      await userEvent.click(await screen.findByRole("button", { name: "Next question" }));
      const radios = await screen.findAllByRole("radio");
      await userEvent.click(radios[0]!);
      await userEvent.click(await screen.findByRole("button", { name: "Check answer" }));
    }
    await userEvent.click(await screen.findByRole("button", { name: "See results" }));
    expect(await screen.findByText("You answered 1 of 3 correctly.")).toBeInTheDocument();
  });
});

describe("QuizPage", () => {
  it("generates a quiz and submits the attempt for server scoring", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = typeof input === "string" ? input : String(input);
      if (path === "/api/quiz") return Promise.resolve(jsonResponse(QUESTIONS_BODY));
      if (path.startsWith("/api/quiz/") && path.endsWith("/attempts")) {
        return Promise.resolve(jsonResponse({ score: 2, total: 3 }));
      }
      if (path === "/api/guest/session") {
        return Promise.resolve(jsonResponse({ expiresAt: "x", usage: [] }));
      }
      return Promise.resolve(jsonResponse({ used: 0, limit: 3 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/en/quizzes");
    await screen.findByLabelText(/Quiz topic/i);

    await userEvent.type(screen.getByLabelText(/Quiz topic/i), "Gravity");
    await userEvent.click(screen.getByRole("button", { name: "Generate quiz" }));

    // Answer all questions (first option) and submit — flow-agnostic loop.
    for (;;) {
      const radios = screen.queryAllByRole("radio");
      if (radios.length === 0) break;
      await userEvent.click(radios[0]!);
      const submit = screen.queryByRole("button", { name: "Submit quiz" });
      const next = screen.queryByRole("button", { name: "Next question" });
      const button = submit ?? next;
      if (!button) break;
      const wasFinish = submit !== null;
      await userEvent.click(button);
      if (wasFinish) break;
    }

    const attemptCall = fetchMock.mock.calls.find(([p]) => String(p).endsWith("/attempts"));
    expect(attemptCall).toBeDefined();
  });
});
