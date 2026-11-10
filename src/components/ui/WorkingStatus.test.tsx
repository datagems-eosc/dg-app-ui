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
