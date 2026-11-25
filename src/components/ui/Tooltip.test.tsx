import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows on keyboard focus when asked to", () => {
    render(
      <Tooltip content="Download CSV" showOnFocus delay={0}>
        <button type="button">Save</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole("button"));
    act(() => vi.runAllTimers());
    expect(screen.getByText("Download CSV")).toBeInTheDocument();

    fireEvent.blur(screen.getByRole("button"));
    expect(screen.queryByText("Download CSV")).not.toBeInTheDocument();
  });

  it("keeps hover-only behaviour by default", () => {
    render(
      <Tooltip content="Details" delay={0}>
        <button type="button">Info</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole("button"));
    act(() => vi.runAllTimers());
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });
});
