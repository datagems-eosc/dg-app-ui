import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineNotice, Notice } from "./Notice";

/** The lucide icon a notice shows, by its glyph class. */
const iconOf = (container: HTMLElement) =>
  container.querySelector("svg")?.getAttribute("class") ?? "";

describe("InlineNotice", () => {
  // A short qualification beside content: a check mark would read as a
  // second outcome, so success keeps the plain info glyph.
  it("shows the info icon for the success tone", () => {
    const { container } = render(
      <InlineNotice tone="success" title="Dataset ready." />,
    );

    expect(iconOf(container)).toContain("lucide-info");
  });

  it("keeps the warning and problem icons for caution and problem", () => {
    const caution = render(<InlineNotice tone="caution" title="Check." />);
    expect(iconOf(caution.container)).toContain("lucide-triangle-alert");

    const problem = render(<InlineNotice tone="problem" title="Failed." />);
    expect(iconOf(problem.container)).toContain("lucide-circle-x");
  });
});

describe("Notice", () => {
  it("shows the check icon for the success tone", () => {
    const { container } = render(<Notice tone="success" title="Done" />);

    expect(iconOf(container)).toContain("lucide-circle-check");
  });

  // File names and ids have no break points, so by default the body may
  // break anywhere.
  it("lets the body break anywhere by default", () => {
    render(
      <Notice
        tone="neutral"
        title="Upload"
        body="file_name_without_breaks.csv"
      />,
    );

    expect(screen.getByText("file_name_without_breaks.csv")).toHaveClass(
      "wrap-anywhere",
    );
  });

  it("breaks the body only between words when asked", () => {
    render(
      <Notice
        tone="neutral"
        title="Processing"
        body="Plain sentence."
        wrap="words"
      />,
    );

    const body = screen.getByText("Plain sentence.");
    expect(body).toHaveClass("break-words");
    expect(body).not.toHaveClass("wrap-anywhere");
  });
});
