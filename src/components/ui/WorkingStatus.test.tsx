import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkingStatus } from "./WorkingStatus";

const MESSAGES = ["Searching inside the data", "Still searching"] as const;

const visible = (container: HTMLElement) =>
  container.querySelector('[data-active="true"]')?.textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WorkingStatus", () => {
  it("shows and announces the first message", () => {
    const { container } = render(<WorkingStatus messages={MESSAGES} />);
    expect(visible(container)).toContain("Searching inside the data");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching inside the data",
    );
  });

  it("announces its own text when given one", () => {
    render(
      <WorkingStatus
        messages={MESSAGES}
        announcement="Searching for rainfall"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching for rainfall",
    );
  });

  it("moves to the next message every six seconds and starts over", () => {
    vi.useFakeTimers();
    const { container } = render(<WorkingStatus messages={MESSAGES} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(visible(container)).toContain("Still searching");
    act(() => vi.advanceTimersByTime(6000));
    expect(visible(container)).toContain("Searching inside the data");
  });

  it("stays on the last message when it does not repeat", () => {
    vi.useFakeTimers();
    const { container } = render(
      <WorkingStatus messages={MESSAGES} repeat={false} />,
    );
    act(() => vi.advanceTimersByTime(18000));
    expect(visible(container)).toContain("Still searching");
  });

  it("keeps the announcement stable while the visible text changes", () => {
    vi.useFakeTimers();
    render(<WorkingStatus messages={MESSAGES} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching inside the data",
    );
  });

  it("shows no elapsed time unless asked to", () => {
    render(<WorkingStatus messages={MESSAGES} />);
    expect(screen.queryByText("0:00")).not.toBeInTheDocument();
  });

  it("starts the elapsed time at zero", () => {
    render(<WorkingStatus messages={MESSAGES} elapsed />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it.each([
    [1_000, "0:01"],
    [42_000, "0:42"],
    [65_000, "1:05"],
    [600_000, "10:00"],
  ])("counts the elapsed time up: after %i ms it reads %s", (ms, text) => {
    vi.useFakeTimers();
    render(<WorkingStatus messages={MESSAGES} elapsed />);
    act(() => vi.advanceTimersByTime(ms));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("stops counting when it is removed", () => {
    vi.useFakeTimers();
    const { unmount } = render(<WorkingStatus messages={MESSAGES} elapsed />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the elapsed time away from screen readers", () => {
    vi.useFakeTimers();
    render(<WorkingStatus messages={MESSAGES} elapsed />);
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Searching inside the data$/,
    );
    expect(screen.getByText("0:07")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps counting when the user prefers reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({ matches: true }) as unknown as typeof matchMedia,
    );
    const { container } = render(<WorkingStatus messages={MESSAGES} elapsed />);
    act(() => vi.advanceTimersByTime(12000));
    expect(visible(container)).toContain("Searching inside the data");
    expect(screen.getByText("0:12")).toBeInTheDocument();
  });

  it("does not change the text when the user prefers reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({ matches: true }) as unknown as typeof matchMedia,
    );
    const { container } = render(<WorkingStatus messages={MESSAGES} />);
    act(() => vi.advanceTimersByTime(12000));
    expect(visible(container)).toContain("Searching inside the data");
  });
});
