import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

describe("RecommendationsSkeleton", () => {
  it("announces that recommendations are loading", () => {
    render(<RecommendationsSkeleton />);

    expect(
      screen.getByRole("status", { name: "Loading recommendations" }),
    ).toBeInTheDocument();
  });

  it("should render skeleton elements with animation", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(5);
  });
});
