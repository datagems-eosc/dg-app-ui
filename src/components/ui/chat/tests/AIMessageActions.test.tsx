import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AIMessageActions } from "../AIMessageActions";

describe("AIMessageActions", () => {
  it("shows the source count with a plural label", () => {
    render(<AIMessageActions sources={3} />);

    expect(
      screen.getByRole("button", { name: "3 Sources" }),
    ).toBeInTheDocument();
  });

  it("uses the singular label for one source", () => {
    render(<AIMessageActions sources={1} />);

    expect(
      screen.getByRole("button", { name: "1 Source" }),
    ).toBeInTheDocument();
  });

  it("offers no Download until downloads work", () => {
    render(<AIMessageActions sources={2} />);

    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there are no sources", () => {
    const { container, rerender } = render(<AIMessageActions />);
    expect(container).toBeEmptyDOMElement();

    rerender(<AIMessageActions sources={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the sources when Sources is clicked", async () => {
    const user = userEvent.setup();
    const onSourcesClick = vi.fn();
    render(<AIMessageActions sources={2} onSourcesClick={onSourcesClick} />);

    await user.click(screen.getByRole("button", { name: "2 Sources" }));

    expect(onSourcesClick).toHaveBeenCalledTimes(1);
  });
});
