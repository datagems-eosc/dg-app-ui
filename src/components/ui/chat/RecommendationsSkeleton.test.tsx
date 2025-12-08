import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

describe("RecommendationsSkeleton", () => {
  it("should render the skeleton structure", () => {
    render(<RecommendationsSkeleton />);

    const container = screen.getByRole("generic");
    expect(container).toBeInTheDocument();
  });

  it("should render skeleton elements with animation", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(5);
  });

  it("should render title skeleton and four recommendation skeletons", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const titleSkeleton = container.querySelector(".w-64.h-5");
    expect(titleSkeleton).toBeInTheDocument();

    const recommendationSkeletons = container.querySelectorAll(".h-8");
    expect(recommendationSkeletons).toHaveLength(4);
  });
});
