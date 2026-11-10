import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

describe("RecommendationsSkeleton", () => {
  it("should render the skeleton structure", () => {
    const { container } = render(<RecommendationsSkeleton />);

    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("should render skeleton elements with animation", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(5);
  });
});
