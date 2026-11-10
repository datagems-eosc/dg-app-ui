import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeQueryEntry } from "./HomeQueryEntry";
import type { HomeQueryState } from "./useHomeQuery";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const EXAMPLES = {
  idle: ["rainfall datasets for Crete", "How hot was Athens in July 2024?"],
  outOfScope: ["Greek language corpora"],
};

const renderEntry = (
  state: HomeQueryState,
  examples: { idle: string[]; outOfScope: string[] } = EXAMPLES,
) => {
  const handlers = {
    onTextChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onChoose: vi.fn(),
    onRetry: vi.fn(),
  };
  const view = render(
    <HomeQueryEntry state={state} examples={examples} {...handlers} />,
  );
  return { ...view, ...handlers };
};

const textbox = () => screen.getByRole("textbox", { name: /type a topic/i });

afterEach(() => {
  vi.useRealTimers();
});

describe("HomeQueryEntry", () => {
  describe("idle", () => {
    it("shows the input, examples and the browse-all link", () => {
      renderEntry({ status: "idle", text: "" });
      expect(textbox()).toHaveAttribute(
        "placeholder",
        "Type a topic or a question…",
      );
      expect(
        screen.getByRole("button", { name: "rainfall datasets for Crete" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /or browse all datasets/i }),
      ).toHaveAttribute("href", "/browse");
    });

    it("disables send for empty input", () => {
      renderEntry({ status: "idle", text: "  " });
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("fills the input from an example without submitting", () => {
      const { onTextChange, onSubmit } = renderEntry({
        status: "idle",
        text: "",
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: "How hot was Athens in July 2024?",
        }),
      );
      expect(onTextChange).toHaveBeenCalledWith(
        "How hot was Athens in July 2024?",
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submits on Enter but not on Shift+Enter", () => {
      const { onSubmit } = renderEntry({ status: "idle", text: "rainfall" });
      fireEvent.keyDown(textbox(), { key: "Enter", shiftKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.keyDown(textbox(), { key: "Enter" });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("blocks submission over the length limit with an explanation", () => {
      const { onSubmit } = renderEntry({
        status: "idle",
        text: "x".repeat(2001),
      });
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
      expect(screen.getByText(/under 2,000 characters/i)).toBeInTheDocument();
      fireEvent.keyDown(textbox(), { key: "Enter" });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("classifying", () => {
    it("shows the status, Cancel and placeholders; hides send and idle helpers", () => {
      const { onCancel } = renderEntry({
        status: "classifying",
        text: "surface temperature in Greece",
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Working out what you need",
      );
      expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
      expect(
        screen.queryByRole("link", { name: /or browse all datasets/i }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: "How hot was Athens in July 2024?",
        }),
      ).toBeNull();
      expect(screen.getByTestId("home-query-placeholder")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("offers no Cancel once navigation has started", () => {
      renderEntry({ status: "navigating", text: "rainfall in Crete" });
      expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    });

    it("cycles the visible status every six seconds", () => {
      vi.useFakeTimers();
      const { container } = renderEntry({ status: "classifying", text: "q" });
      const visible = () =>
        container.querySelector('[data-active="true"]')?.textContent;
      expect(visible()).toContain("Working out what you need");
      act(() => vi.advanceTimersByTime(6000));
      expect(visible()).toContain("Choosing where to take you");
      act(() => vi.advanceTimersByTime(6000));
      expect(visible()).toContain("Checking how best to help");
      act(() => vi.advanceTimersByTime(6000));
      expect(visible()).toContain("Working out what you need");
    });

    it("keeps the announced status stable while the visual text cycles", () => {
      vi.useFakeTimers();
      renderEntry({ status: "classifying", text: "q" });
      act(() => vi.advanceTimersByTime(6000));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Working out what you need",
      );
    });
  });

  describe("clarify", () => {
    it("asks which outcome the user wants and continues with the choice", () => {
      const { onChoose } = renderEntry({
        status: "clarify",
        text: "surface temperature in Greece",
        degraded: false,
      });
      expect(
        screen.getByRole("heading", { name: "What would you like to do?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/“surface temperature in Greece” could mean either/),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /get an answer/i }));
      expect(onChoose).toHaveBeenCalledWith("question");
      fireEvent.click(screen.getByRole("button", { name: /find datasets/i }));
      expect(onChoose).toHaveBeenCalledWith("dataset_search");
    });

    it("moves focus to the first choice", () => {
      renderEntry({ status: "clarify", text: "q", degraded: false });
      expect(
        screen.getByRole("button", { name: /find datasets/i }),
      ).toHaveFocus();
    });

    it("returns focus to the input on Escape", () => {
      renderEntry({ status: "clarify", text: "q", degraded: false });
      fireEvent.keyDown(
        screen.getByRole("button", { name: /find datasets/i }),
        {
          key: "Escape",
        },
      );
      expect(textbox()).toHaveFocus();
    });

    it.each([
      [{ status: "failed", text: "q", kind: "network" } as HomeQueryState],
      [{ status: "outOfScope", text: "q" } as HomeQueryState],
    ])("returns focus to the input on Escape from %o", (state) => {
      renderEntry(state);
      fireEvent.keyDown(
        screen.getByRole("button", { name: /find datasets/i }),
        {
          key: "Escape",
        },
      );
      expect(textbox()).toHaveFocus();
    });

    it("explains a degraded result instead of claiming ambiguity", () => {
      renderEntry({ status: "clarify", text: "air quality", degraded: true });
      expect(
        screen.getByText(/can't pick the right place for your request/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/could mean either/)).toBeNull();
    });

    it("hides the idle helpers", () => {
      renderEntry({ status: "clarify", text: "q", degraded: false });
      expect(
        screen.queryByRole("link", { name: /or browse all datasets/i }),
      ).toBeNull();
    });
  });

  describe("out of scope", () => {
    it("explains the limit, offers examples and Find datasets", () => {
      const { onChoose, onTextChange } = renderEntry({
        status: "outOfScope",
        text: "Book me a flight to Athens",
      });
      expect(
        screen.getByRole("heading", { name: "DataGEMS can't help with this" }),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Greek language corpora" }),
      );
      expect(onTextChange).toHaveBeenCalledWith("Greek language corpora");
      fireEvent.click(screen.getByRole("button", { name: /find datasets/i }));
      expect(onChoose).toHaveBeenCalledWith("dataset_search");
      expect(
        screen.queryByRole("button", { name: /get an answer/i }),
      ).toBeNull();
    });
  });

  describe("failed", () => {
    it("shows the error, Try again and both choices", () => {
      const { onRetry, onChoose } = renderEntry({
        status: "failed",
        text: "rainfall trends in Crete",
        kind: "network",
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn't check your request.",
      );
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /get an answer/i }));
      expect(onChoose).toHaveBeenCalledWith("question");
    });
  });
});
