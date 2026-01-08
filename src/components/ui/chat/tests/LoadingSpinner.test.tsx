import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render loading message and spinner", () => {
    render(<LoadingSpinner />);

    const loadingText = screen.getByText("Loading messages...");
    expect(loadingText).toBeInTheDocument();
    expect(loadingText).toBeVisible();
  });
});
