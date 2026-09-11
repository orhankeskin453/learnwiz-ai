import "@/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

describe("Button", () => {
  it("fires onClick and respects disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Save</Button>
        <Button disabled onClick={onClick}>
          No
        </Button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the primary token classes by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toMatch(/bg-primary/);
  });
});

describe("Input", () => {
  it("accepts typed value", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="email" type="email" />);
    const input = screen.getByLabelText("email");
    await user.type(input, "a@b.co");
    expect(input).toHaveValue("a@b.co");
  });
});

describe("Card + Badge", () => {
  it("renders header/content and semantic badge variants", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title here</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="success">ok</Badge>
          <Badge variant="warning">warn</Badge>
          <Badge variant="error">err</Badge>
          <Badge variant="info">info</Badge>
        </CardContent>
      </Card>,
    );
    expect(screen.getByText("Title here")).toBeInTheDocument();
    expect(screen.getByText("ok").className).toMatch(/bg-success/);
    expect(screen.getByText("warn").className).toMatch(/bg-warning/);
    expect(screen.getByText("err").className).toMatch(/bg-destructive/);
    expect(screen.getByText("info").className).toMatch(/bg-info/);
  });
});

describe("State components", () => {
  it("EmptyState renders title, description and action", () => {
    render(
      <EmptyState
        title="Nothing yet"
        description="Check back later."
        action={<Button>Act</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
    expect(screen.getByText("Check back later.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("LoadingState has role=status and localized default label (en)", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("ErrorState has role=alert, localized default message, working retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("state components have no axe violations", async () => {
    const { container } = render(
      <main>
        <EmptyState title="Empty" />
        <LoadingState />
        <ErrorState />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
