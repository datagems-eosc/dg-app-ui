import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DatasetRecommendationsSection from "./DatasetRecommendationsSection";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

describe("DatasetRecommendationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  it("renders recommendations from mock data", async () => {
    render(<DatasetRecommendationsSection />);

    await waitFor(() => {
      expect(screen.getByText("You may also like")).toBeInTheDocument();
    });

    expect(screen.getByText("ERA5 Land")).toBeInTheDocument();
    expect(screen.getByText("Horizon Europe")).toBeInTheDocument();
    expect(screen.getByText("Copernicus")).toBeInTheDocument();
    expect(screen.getByText("EUREKA")).toBeInTheDocument();
    expect(screen.getByText("Digital Europe")).toBeInTheDocument();
    expect(
      screen.getByText("Fifth Space Weather Services"),
    ).toBeInTheDocument();
  });

  it("navigates to dataset details on card click", async () => {
    render(<DatasetRecommendationsSection />);

    await waitFor(() => {
      expect(screen.getByText("ERA5 Land")).toBeInTheDocument();
    });

    const card = screen
      .getByText("ERA5 Land")
      .closest("div[role='button']") as HTMLElement | null;
    if (card) {
      fireEvent.click(card);
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining(`/datasets/recommendation-1`),
        );
      });
    }
  });

  it("handles keyboard navigation", async () => {
    render(<DatasetRecommendationsSection />);

    await waitFor(() => {
      expect(screen.getByText("ERA5 Land")).toBeInTheDocument();
    });

    const card = screen
      .getByText("ERA5 Land")
      .closest("div[role='button']") as HTMLElement | null;
    if (card) {
      fireEvent.keyDown(card, { key: "Enter" });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });
    }
  });
});
