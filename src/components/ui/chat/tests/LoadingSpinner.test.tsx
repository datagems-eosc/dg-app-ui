import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading message and spinner", () => {
    render(<LoadingSpinner />);

    const loadingText = screen.getByText("Loading messages...");
    expect(loadingText).toBeInTheDocument();
    expect(loadingText).toBeVisible();
  });
});
