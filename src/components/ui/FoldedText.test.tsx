import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./__testing__/layout";
import { FoldedText } from "./FoldedText";

afterEach(() => vi.restoreAllMocks());

// 300 px at 8 px a character: 37 characters a line.
const lines = (count: number) => "word ".repeat(Math.ceil((count * 37) / 5));

describe("FoldedText", () => {
  it("shows short text whole, without a toggle", () => {
    stubLayout({ width: 300 });
    render(<FoldedText text={lines(3)} lines={4} about="citation" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not fold when that would hide a single line", () => {
    stubLayout({ width: 300 });
    render(<FoldedText text={lines(5)} lines={4} about="citation" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("folds long text to its lines and expands and collapses it", () => {
    stubLayout({ width: 300 });
    const { container } = render(
      <FoldedText text={lines(10)} lines={4} about="citation" />,
    );
    const body = container.querySelector("[data-folded]") as HTMLElement;
    expect(body).toHaveAttribute("data-folded", "true");
    expect(body.style.maxHeight).toBe("96px");

    fireEvent.click(
      screen.getByRole("button", { name: "Show more of the citation" }),
    );
    expect(body).toHaveAttribute("data-folded", "false");
    expect(body.style.maxHeight).toBe("");
    const less = screen.getByRole("button", {
      name: "Show less of the citation",
    });
    expect(less).toHaveAttribute("aria-expanded", "true");
    expect(less).toHaveTextContent("Show less");
  });
});
