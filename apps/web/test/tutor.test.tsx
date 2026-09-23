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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** URL-dispatching fetch mock — mount effects (quota/conversations) answer separately from chat. */
function stubFetchByPath(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : String(input);
    const handler = handlers[path] ?? (() => jsonResponse({}, 404));
    return Promise.resolve(handler());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const EMPTY_MOUNT = {
  "/api/guest/session": () =>
    jsonResponse({
      expiresAt: "2026-09-19T00:00:00.000Z",
      usage: [{ feature: "ai_tutor", used: 0, limit: 3 }],
    }),
  "/api/tutor/quota": () => jsonResponse({ used: 0, limit: 3 }),
  "/api/tutor/conversations": () => jsonResponse([]),
};

describe("TutorPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the tutor shell with suggested actions and empty state", async () => {
    stubFetchByPath({ ...EMPTY_MOUNT });
    renderAt("/en/tutor");
    expect(await screen.findByRole("heading", { name: "AI Tutor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain a concept" })).toBeInTheDocument();
    expect(screen.getByText("Meet your AI teacher")).toBeInTheDocument();
  });

  it("labels guest quota as a per-session total, not a daily window", async () => {
    stubFetchByPath({
      ...EMPTY_MOUNT,
      "/api/tutor/quota": () => jsonResponse({ used: 2, limit: 3, scope: "session" }),
    });
    renderAt("/en/tutor");
    expect(
      await screen.findByText("2 of 3 free AI tutor messages used", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("labels an authenticated quota as daily", async () => {
    stubFetchByPath({
      ...EMPTY_MOUNT,
      "/api/tutor/quota": () => jsonResponse({ used: 2, limit: 10, scope: "daily" }),
    });
    renderAt("/en/tutor");
    expect(
      await screen.findByText("2 of 10 free messages used today", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("sends a turn, shows the user message and the assistant answer with the conversation id kept", async () => {
    const fetchMock = stubFetchByPath({
      ...EMPTY_MOUNT,
      "/api/tutor/chat": () =>
        jsonResponse({
          conversationId: "a".repeat(32),
          assistantMessage: "Photosynthesis is how plants make food.",
          usage: { inputTokens: 12, outputTokens: 30, fallback: false },
        }),
    });

    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });

    await userEvent.type(screen.getByLabelText(/Your question/i), "What is photosynthesis?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Photosynthesis is how plants make food.")).toBeInTheDocument();
    });
    expect(screen.getByText("What is photosynthesis?")).toBeInTheDocument();

    const chatCall = fetchMock.mock.calls.find(([p]) => p === "/api/tutor/chat")!;
    const init = chatCall[1] as RequestInit;
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

  it("resumes the latest conversation on mount (§29 context continuity)", async () => {
    stubFetchByPath({
      "/api/tutor/quota": () => jsonResponse({ used: 1, limit: 3 }),
      "/api/tutor/conversations": () =>
        jsonResponse([
          {
            id: "b".repeat(32),
            title: "Photosynthesis",
            locale: "en",
            updatedAt: "2026-09-12T00:00:00.000Z",
          },
        ]),
      [`/api/tutor/conversations/${"b".repeat(32)}`]: () =>
        jsonResponse({
          id: "b".repeat(32),
          title: "Photosynthesis",
          locale: "en",
          updatedAt: "2026-09-12T00:00:00.000Z",
          messages: [
            {
              id: "m1",
              role: "user",
              action: "chat",
              content: "What is photosynthesis?",
              createdAt: "2026-09-12T00:00:00.000Z",
            },
            {
              id: "m2",
              role: "assistant",
              action: "chat",
              content: "Plants making food from light.",
              createdAt: "2026-09-12T00:00:01.000Z",
            },
          ],
        }),
    });
    renderAt("/en/tutor");
    expect(await screen.findByText("Plants making food from light.")).toBeInTheDocument();
    expect(screen.getByText("What is photosynthesis?")).toBeInTheDocument();
  });

  it("creates a guest session on mount before the first chat", async () => {
    const fetchMock = stubFetchByPath({ ...EMPTY_MOUNT });
    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([p]) => p === "/api/guest/session")).toBe(true);
    });
  });

  it("retries the chat once after creating a session when the first call 401s", async () => {
    let chatCalls = 0;
    const fetchMock = stubFetchByPath({
      "/api/guest/session": () =>
        jsonResponse({
          expiresAt: "2026-09-19T00:00:00.000Z",
          usage: [{ feature: "ai_tutor", used: 0, limit: 3 }],
        }),
      "/api/tutor/quota": () => jsonResponse({ used: 0, limit: 3 }),
      "/api/tutor/conversations": () => jsonResponse([]),
      "/api/tutor/chat": () => {
        chatCalls += 1;
        if (chatCalls === 1) return jsonResponse({ error: "unauthenticated" }, 401);
        return jsonResponse({
          conversationId: "c".repeat(32),
          assistantMessage: "Answered after retry.",
          usage: { inputTokens: 10, outputTokens: 20, fallback: false },
        });
      },
    });

    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([p]) => p === "/api/guest/session")).toBe(true);
    });

    await userEvent.type(screen.getByLabelText(/Your question/i), "Still there?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Answered after retry.")).toBeInTheDocument();
    expect(chatCalls).toBe(2);
  });

  it("shows the localized quota error when the limit is reached", async () => {
    stubFetchByPath({
      ...EMPTY_MOUNT,
      "/api/tutor/chat": () => jsonResponse({ error: "ai_limit_reached" }, 403),
    });
    renderAt("/en/tutor");
    await screen.findByRole("heading", { name: "AI Tutor" });

    await userEvent.type(screen.getByLabelText(/Your question/i), "One more?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have used all of your free AI messages",
    );
  });
});
