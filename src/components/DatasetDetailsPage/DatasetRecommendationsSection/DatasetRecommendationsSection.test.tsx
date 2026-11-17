import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";

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

const datasets = (
  ...items: Record<string, unknown>[]
): DatasetRecommendationsResult => ({ status: "datasets", datasets: items });

const pending = () => {
  let resolve: (value: DatasetRecommendationsResult) => void = () => {};
  const promise = new Promise<DatasetRecommendationsResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

beforeEach(() => {
  getDatasetRecommendations.mockReset();
  mockPush.mockReset();
});

describe("DatasetRecommendationsSection — loading", () => {
  it("shows six placeholder cards and the working status while the request runs", () => {
    getDatasetRecommendations.mockReturnValue(pending().promise);

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(screen.getByText("Recommended datasets")).toBeInTheDocument();
    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Finding similar datasets",
    );
  });

  it("replaces the placeholders with the recommended datasets", async () => {
    const request = pending();
    getDatasetRecommendations.mockReturnValue(request.promise);

    render(<DatasetRecommendationsSection datasetId="d1" />);
    request.resolve(
      datasets({ id: "r1", name: "Alpha Dataset", description: "desc" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(getDatasetRecommendations).toHaveBeenCalledWith("d1");
  });
});

describe("DatasetRecommendationsSection — notes", () => {
  it.each<[DatasetRecommendationsResult["status"], string]>([
    ["none", "No similar datasets found."],
    [
      "noAccess",
      "Recommendations are shown only for datasets you have access to.",
    ],
    ["failed", "Recommendations are not available for this dataset right now."],
  ])(
    "shows the heading and a note when the result is %s",
    async (status, note) => {
      getDatasetRecommendations.mockResolvedValue({ status });

      render(<DatasetRecommendationsSection datasetId="d1" />);

      expect(await screen.findByText(note)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Recommended datasets" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    },
  );
});

describe("DatasetRecommendationsSection — dataset change", () => {
  it("never shows a late answer for the previous dataset", async () => {
    const first = pending();
    const second = pending();
    getDatasetRecommendations
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    rerender(<DatasetRecommendationsSection datasetId="d2" />);
    await act(async () => {
      first.resolve(datasets({ id: "old", name: "Old Answer" }));
      await first.promise;
    });

    expect(screen.queryByText("Old Answer")).toBeNull();
    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);

    second.resolve(datasets({ id: "new", name: "New Answer" }));
    expect(await screen.findByText("New Answer")).toBeInTheDocument();
    expect(screen.queryByText("Old Answer")).toBeNull();
    expect(getDatasetRecommendations).toHaveBeenLastCalledWith("d2");
  });

  it("goes back to loading when the dataset changes after an answer", async () => {
    getDatasetRecommendations
      .mockResolvedValueOnce(datasets({ id: "old", name: "Old Answer" }))
      .mockReturnValueOnce(pending().promise);

    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await screen.findByText("Old Answer");
    rerender(<DatasetRecommendationsSection datasetId="d2" />);

    expect(screen.queryByText("Old Answer")).toBeNull();
    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);
  });
});

describe("DatasetRecommendationsSection — navigation", () => {
  it("navigates to the dataset details page on card click", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", description: "desc" }),
    );
    render(<DatasetRecommendationsSection datasetId="d1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Alpha Dataset/ }),
    );

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/datasets/r1"),
    );
  });

  it.each(["Enter", " "])("navigates on %j", async (key) => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", description: "desc" }),
    );
    render(<DatasetRecommendationsSection datasetId="d1" />);

    fireEvent.keyDown(
      await screen.findByRole("button", { name: /Alpha Dataset/ }),
      { key },
    );

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/datasets/r1"),
    );
  });
});

/**
 * PM-01 finding F1.
 *
 * `Dataset.access` is optional, and this card rendered it unguarded: with no
 * value it produced an empty chip coloured as a warning, which reads as
 * "Restricted" without saying so. Recommendations carry no publication
 * evidence at all, so the card shows no access chip.
 */
describe("DatasetRecommendationsSection — publication badge", () => {
  it("renders no publication chip", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({
        id: "r1",
        name: "Alpha Dataset",
        description: "desc",
        // The caller can browse it. That says nothing about anyone else.
        permissions: ["browsedataset"],
      }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    expect(screen.queryByText("Open Access")).toBeNull();
    expect(screen.queryByText("Restricted")).toBeNull();
  });
});

describe("DatasetRecommendationsSection — collection badge", () => {
  it("shows no collection chip when the dataset has no collection", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", description: "desc" }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");
    // The mapper's internal "Math" category is not a collection (#251).
    expect(screen.queryByText("Math")).toBeNull();
    expect(screen.getByText("desc")).toBeInTheDocument();
  });

  it("shows a genuine collection name", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({
        id: "r1",
        name: "Alpha Dataset",
        description: "desc",
        collections: [{ id: "c1", name: "Meteo Collection" }],
      }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");
    expect(screen.getByText("Meteo")).toBeInTheDocument();
  });
});

describe("DatasetRecommendationsSection — card chips", () => {
  const chipsOf = (title: string) =>
    within(screen.getByRole("button", { name: new RegExp(title) })).getByTestId(
      "recommendation-chips",
    );

  it("shows the collection as a filled grey chip and the licence as a green chip", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({
        id: "r1",
        name: "Alpha Dataset",
        license: "CC BY 4.0",
        collections: [{ id: "c1", name: "Meteo Collection" }],
      }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    const chips = chipsOf("Alpha Dataset");
    expect(
      within(chips).getByText("Meteo").closest(".rounded-full"),
    ).toHaveClass("bg-slate-100");
    expect(
      within(chips).getByText("CC BY 4.0").closest(".rounded-full"),
    ).toHaveClass("bg-emerald-50");
  });

  it("shows only the licence chip when there is no collection", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", license: "MIT" }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    expect(chipsOf("Alpha Dataset").children).toHaveLength(1);
    expect(within(chipsOf("Alpha Dataset")).getByText("MIT")).toBeVisible();
  });

  it("keeps an empty chip row when there is neither collection nor licence", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets(
        { id: "r1", name: "Alpha Dataset" },
        {
          id: "r2",
          name: "Beta Dataset",
          license: "MIT",
          collections: [{ id: "c1", name: "Meteo Collection" }],
        },
      ),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    expect(chipsOf("Alpha Dataset")).toBeEmptyDOMElement();
    expect(chipsOf("Beta Dataset").children).toHaveLength(2);
  });

  it("shows no access chip even when the dataset carries an access value", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", access: "Open Access" }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    expect(screen.queryByText("Open Access")).toBeNull();
  });
});
