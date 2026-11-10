import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

describe("RecommendationsSkeleton", () => {
  it("should render the skeleton structure", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const root = container.firstElementChild;
    expect(root).toBeInTheDocument();
    // A title placeholder followed by a row of four suggestion placeholders.
    expect(root?.children).toHaveLength(2);
    expect(root?.lastElementChild?.children).toHaveLength(4);
  });

  it("should render skeleton elements with animation", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(5);
  });
});
