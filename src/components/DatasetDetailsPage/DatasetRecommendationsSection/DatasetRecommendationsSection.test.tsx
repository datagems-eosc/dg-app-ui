import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDatasetRecommendations } = vi.hoisted(() => ({
  getDatasetRecommendations: vi.fn(),
}));
const mockPush = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({ getDatasetRecommendations }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import DatasetRecommendationsSection from "./DatasetRecommendationsSection";

describe("DatasetRecommendationsSection", () => {
  beforeEach(() => {
    getDatasetRecommendations.mockReset();
    mockPush.mockReset();
  });

  it("shows the section while loading, then renders the recommended datasets", async () => {
    let resolve: (value: unknown[]) => void = () => {};
    getDatasetRecommendations.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    expect(screen.getByText("Recommended datasets")).toBeInTheDocument();

    resolve([
      {
        id: "r1",
        name: "Alpha Dataset",
        description: "desc",
        permissions: ["browsedataset"],
      },
    ]);

    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );
    expect(getDatasetRecommendations).toHaveBeenCalledWith("d1");
  });

  it("navigates to the dataset details page on card click", async () => {
    getDatasetRecommendations.mockResolvedValue([
      { id: "r1", name: "Alpha Dataset", description: "desc" },
    ]);
    render(<DatasetRecommendationsSection datasetId="d1" />);

    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );
    const card = screen
      .getByText("Alpha Dataset")
      .closest("div[role='button']") as HTMLElement | null;
    if (card) fireEvent.click(card);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/datasets/r1"),
      ),
    );
  });

  it("renders nothing when there are no recommendations", async () => {
    getDatasetRecommendations.mockResolvedValue([]);
    const { container } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

/**
 * PM-01 finding F1.
 *
 * `Dataset.access` is optional, and this card rendered it unguarded: with no
 * value it produced an empty chip coloured as a warning, which reads as
 * "Restricted" without saying so. Recommendations now carry no publication
 * evidence at all — the mapper no longer infers it from the caller's Browse —
 * so the honest rendering is no badge.
 */
describe("DatasetRecommendationsSection — publication badge", () => {
  beforeEach(() => {
    getDatasetRecommendations.mockReset();
    mockPush.mockReset();
  });

  it("renders no publication chip when there is no evidence", async () => {
    getDatasetRecommendations.mockResolvedValue([
      {
        id: "r1",
        name: "Alpha Dataset",
        description: "desc",
        // The caller can browse it. That says nothing about anyone else.
        permissions: ["browsedataset"],
      },
    ]);

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );

    expect(screen.queryByText("Open Access")).toBeNull();
    expect(screen.queryByText("Restricted")).toBeNull();
    // No empty chip left behind either.
    const card = screen.getByText("Alpha Dataset").closest("div");
    expect(card?.textContent).not.toMatch(/^\s*$/);
  });

  it("still shows the category chip, so the card is not left blank", async () => {
    getDatasetRecommendations.mockResolvedValue([
      { id: "r1", name: "Alpha Dataset", description: "desc" },
    ]);

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );
    expect(screen.getByText("Math")).toBeInTheDocument();
  });
});
