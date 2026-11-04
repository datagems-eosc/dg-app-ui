import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const classifyIntent = vi.fn();
let flags: Record<string, boolean> = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ userData: { name: "Test" } }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ flags }),
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({ classifyIntent }),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type React from "react";
import { handoffStore } from "@/lib/intentRouting/handoffStore";
import DashboardClient from "./DashboardClient";

const ALL_USE_CASES = {
  useCaseWeather: true,
  useCaseMath: true,
  useCaseLifelongLearning: true,
  useCaseLanguage: true,
};

const topics = () =>
  within(screen.getByRole("region", { name: "Explore by topic" }));

describe("DashboardClient – Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags = { ...ALL_USE_CASES };
  });

  it("greets the user with the new subtitle and shows the query entry", () => {
    render(<DashboardClient />);
    expect(
      screen.getByRole("heading", { name: "Hello, Test!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Search datasets or ask a question about data"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /type a topic or a question/i }),
    ).toBeInTheDocument();
    expect(classifyIntent).not.toHaveBeenCalled();
  });

  it("removes Primary Actions, the Browse All Datasets card and coming-soon cards", () => {
    render(<DashboardClient />);
    expect(screen.queryByText("Primary Actions")).toBeNull();
    expect(screen.queryByText("Browse All Datasets")).toBeNull();
    expect(screen.queryByText("Explore more features")).toBeNull();
    expect(screen.queryByText("Weather Station Map")).toBeNull();
    expect(screen.queryByRole("link", { name: /browse datasets/i })).toBeNull();
  });

  it.each([
    ["Weather", "/use-case/weather/home"],
    ["MathE", "/use-case/math/home"],
    ["Lifelong Learning", "/use-case/lifelong-learning"],
    ["Language", "/use-case/language/home"],
  ])("links the whole %s card to its pilot space", (name, href) => {
    render(<DashboardClient />);
    expect(
      topics().getByRole("link", { name: new RegExp(`^${name}`) }),
    ).toHaveAttribute("href", href);
  });

  it("hides a pilot card whose use-case flag is off, like the navigation", () => {
    flags = { ...ALL_USE_CASES, useCaseMath: false };
    render(<DashboardClient />);
    expect(topics().queryByRole("link", { name: /^MathE/ })).toBeNull();
    expect(topics().getAllByRole("link")).toHaveLength(3);
  });

  it("hands a dataset search to Browse with only an opaque id in the URL", async () => {
    classifyIntent.mockResolvedValue({
      ok: true,
      classification: {
        intent: "dataset_search",
        retrievalQuery: "education",
        degraded: false,
        confidence: 0.9,
        model: null,
        promptVersion: null,
      },
    });
    render(<DashboardClient />);
    fireEvent.change(screen.getByRole("textbox", { name: /type a topic/i }), {
      target: { value: "datasets about education" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });

    expect(classifyIntent).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://app.test");
    expect(url.pathname).toBe("/browse");
    expect(url.search).not.toContain("education");
    const id = url.searchParams.get("handoff") ?? "";
    expect(handoffStore.peek(id)).toEqual({
      originalQuery: "datasets about education",
      retrievalQuery: "education",
      intent: "dataset_search",
      chosenBy: "classifier",
    });
  });

  it("hands a chosen answer to chat", async () => {
    classifyIntent.mockResolvedValue({
      ok: true,
      classification: {
        intent: "ambiguous",
        retrievalQuery: null,
        degraded: false,
        confidence: 0.4,
        model: null,
        promptVersion: null,
      },
    });
    render(<DashboardClient />);
    fireEvent.change(screen.getByRole("textbox", { name: /type a topic/i }), {
      target: { value: "surface temperature in Greece" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    fireEvent.click(screen.getByRole("button", { name: /get an answer/i }));

    const url = new URL(push.mock.calls[0][0], "http://app.test");
    expect(url.pathname).toBe("/chat");
    expect(
      handoffStore.peek(url.searchParams.get("handoff") ?? "")?.chosenBy,
    ).toBe("user");
  });
});
