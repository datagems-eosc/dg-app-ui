import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DatasetVisibilitySection from "./DatasetVisibilitySection";

describe("DatasetVisibilitySection", () => {
  it("shows Open Access only for established publication", () => {
    const { container } = render(<DatasetVisibilitySection sharing="public" />);
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Open Access")).toBeInTheDocument();
  });

  it("shows Restricted for an established negative", () => {
    const { container } = render(
      <DatasetVisibilitySection sharing="restricted" />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Restricted")).toBeInTheDocument();
  });

  it("says sharing is not verified when there is no evidence either way", () => {
    const { container } = render(
      <DatasetVisibilitySection sharing="unknown" />,
    );
    const section = container.firstChild as HTMLElement;

    expect(
      within(section).getByText("Sharing not verified"),
    ).toBeInTheDocument();
    expect(within(section).queryByText("Restricted")).not.toBeInTheDocument();
    expect(within(section).queryByText("Open Access")).not.toBeInTheDocument();
  });

  it("presents the unknown state neutrally rather than as a warning", () => {
    const { container: unknownContainer } = render(
      <DatasetVisibilitySection sharing="unknown" />,
    );
    const { container: restrictedContainer } = render(
      <DatasetVisibilitySection sharing="restricted" />,
    );

    const unknownChip = unknownContainer.querySelector("span");
    const restrictedChip = restrictedContainer.querySelector("span");

    expect(restrictedChip?.className).toContain("orange");
    expect(unknownChip?.className).not.toContain("orange");
    expect(unknownChip?.className).toContain("slate");
  });
});
