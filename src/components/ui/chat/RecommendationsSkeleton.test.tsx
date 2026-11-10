import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

describe("RecommendationsSkeleton", () => {
  it("announces that recommendations are loading", () => {
    const { container } = render(<RecommendationsSkeleton />);

    // Screen readers read a status region's text, not its label.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading recommendations",
    );
    for (const bar of container.querySelectorAll(".animate-pulse")) {
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("should render skeleton elements with animation", () => {
    const { container } = render(<RecommendationsSkeleton />);

    const animatedElements = container.querySelectorAll(".animate-pulse");
    expect(animatedElements.length).toBe(5);
  });
});
