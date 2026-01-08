import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DGIcon from "../DGIcon";

describe("DGIcon", () => {
  it("should render an SVG element", () => {
    const { container } = render(<DGIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should render with default size of 24", () => {
    const { container } = render(<DGIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("should render with custom size when provided", () => {
    const { container } = render(<DGIcon size={48} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });
});
