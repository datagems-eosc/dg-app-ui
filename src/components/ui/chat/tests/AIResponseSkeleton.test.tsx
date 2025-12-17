import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AIResponseSkeleton } from "../AIResponseSkeleton";

describe("AIResponseSkeleton", () => {
  it("should render the skeleton component", () => {
    const { container } = render(<AIResponseSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
  });

  it("should render skeleton loading placeholders with animation", () => {
    const { container } = render(<AIResponseSkeleton />);

    const animatedElements = container.querySelectorAll(
      "[class*='animate-pulse']",
    );
    expect(animatedElements.length).toBeGreaterThan(0);
  });

  it("should render multiple skeleton lines for content", () => {
    const { container } = render(<AIResponseSkeleton />);

    const skeletonElements = container.querySelectorAll("[class*='bg-slate']");
    expect(skeletonElements.length).toBeGreaterThan(3);
  });

  it("should render header and content sections", () => {
    const { container } = render(<AIResponseSkeleton />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer.children.length).toBeGreaterThan(0);
  });
});
