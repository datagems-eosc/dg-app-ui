import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

// Records how each tag is drawn with the shared chip.
vi.mock("@ui/Chip", () => ({
  Chip: ({
    children,
    color,
    variant,
    size,
  }: {
    children: React.ReactNode;
    color?: string;
    variant?: string;
    size?: string;
  }) => (
    <span data-testid="chip" data-style={`${color}/${variant}/${size}`}>
      {children}
    </span>
  ),
}));

import DatasetTagsSection from "./DatasetTagsSection";

describe("DatasetTagsSection", () => {
  it("draws every tag as the filled grey chip, like Collection and Permissions", () => {
    render(
      <DatasetTagsSection title="Keywords" items={["climate", "weather"]} />,
    );

    const chips = screen.getAllByTestId("chip");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "climate",
      "weather",
    ]);
    for (const chip of chips) {
      expect(chip).toHaveAttribute("data-style", "grey/regular/sm");
    }
  });

  it("renders no heading or chip row without values", () => {
    const { container } = render(
      <DatasetTagsSection title="Keywords" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Keywords")).not.toBeInTheDocument();
  });
});
