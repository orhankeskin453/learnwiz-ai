import "@/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("TutorPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the tutor shell with suggested actions and empty state", async () => {
    renderAt("/en/tutor");
    expect(await screen.findByRole("heading", { name: "AI Tutor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain a concept" })).toBeInTheDocument();
    expect(screen.getByText("Meet your AI teacher")).toBeInTheDocument();
  });

  it("sends a turn, shows the user message and the assistant answer with the conversation id kept", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversationId: "a".repeat(32),
          assistantMessage: "Photosynthesis is how plants make food.",
          usage: { inputTokens: 12, outputTokens: 30, fallback: false },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });

    await userEvent.type(screen.getByLabelText(/Your question/i), "What is photosynthesis?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Photosynthesis is how plants make food.")).toBeInTheDocument();
    });
    expect(screen.getByText("What is photosynthesis?")).toBeInTheDocument();

    const [path, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(path).toBe("/api/tutor/chat");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as {
      message: string;
      action: string;
      locale: string;
    };
    expect(body.message).toBe("What is photosynthesis?");
    expect(body.action).toBe("chat");
    expect(body.locale).toBe("en");
  });

  it("shows the localized quota error when the limit is reached", async () => {
    mockFetchOnce({ error: "ai_limit_reached" }, 403);
    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });

    await userEvent.type(screen.getByLabelText(/Your question/i), "One more?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have used all of your free AI messages",
    );
  });
});
