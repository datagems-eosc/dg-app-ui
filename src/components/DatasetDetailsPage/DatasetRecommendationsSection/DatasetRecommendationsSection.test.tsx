import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapApiDatasetToDataset } from "@/lib/datasetMapping";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";

const mocks = vi.hoisted(() => {
  const getDatasetRecommendations = vi.fn();
  // What useApi hands out now; a new session token gives a new function.
  return {
    getDatasetRecommendations,
    current: getDatasetRecommendations,
    hasToken: true,
  };
});
const { getDatasetRecommendations } = mocks;
const mockPush = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    getDatasetRecommendations: mocks.current,
    hasToken: mocks.hasToken,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import DatasetRecommendationsSection from "./DatasetRecommendationsSection";

/** The adapter's answer for these Gateway items, mapped as it maps them. */
const datasets = (
  ...items: Record<string, unknown>[]
): DatasetRecommendationsResult => ({
  status: "datasets",
  datasets: items.map(mapApiDatasetToDataset),
});

const pending = () => {
  let resolve: (value: DatasetRecommendationsResult) => void = () => {};
  const promise = new Promise<DatasetRecommendationsResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

/** What every live region currently holds. */
const announced = () =>
  screen.getAllByRole("status").map((element) => element.textContent);

beforeEach(() => {
  getDatasetRecommendations.mockReset();
  mocks.current = getDatasetRecommendations;
  mocks.hasToken = true;
  mockPush.mockReset();
});

describe("DatasetRecommendationsSection — loading", () => {
  it("shows six placeholder cards and the working status while the request runs", () => {
    getDatasetRecommendations.mockReturnValue(pending().promise);

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(screen.getByText("Recommended datasets")).toBeInTheDocument();
    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);
    expect(announced()).toContain("Finding similar datasets");
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
    expect(announced()).toEqual([""]);
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
      expect(announced()).toEqual([note]);
    },
  );
});

describe("DatasetRecommendationsSection — note announcement", () => {
  it("puts the note in a live region that was already on the page", async () => {
    const request = pending();
    getDatasetRecommendations.mockReturnValue(request.promise);

    render(<DatasetRecommendationsSection datasetId="d1" />);
    // Screen readers skip a live region that appears with its text in it.
    const region = screen
      .getAllByRole("status")
      .find((element) => element.textContent === "");
    expect(region).toBeDefined();

    await act(async () => {
      request.resolve({ status: "none" });
      await request.promise;
    });

    expect(region).toHaveTextContent("No similar datasets found.");
    expect(region).toBeInTheDocument();
  });
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

describe("DatasetRecommendationsSection — session token refresh", () => {
  it("keeps the answer and uses the new token only for another dataset", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset" }),
    );
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await screen.findByText("Alpha Dataset");

    const refreshed = vi.fn().mockResolvedValue({ status: "failed" });
    mocks.current = refreshed;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {});

    expect(refreshed).not.toHaveBeenCalled();
    expect(screen.getByText("Alpha Dataset")).toBeInTheDocument();

    rerender(<DatasetRecommendationsSection datasetId="d2" />);
    expect(refreshed).toHaveBeenCalledWith("d2");
  });

  it("waits for a session token before asking", async () => {
    mocks.hasToken = false;
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset" }),
    );
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await act(async () => {});

    expect(getDatasetRecommendations).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);

    mocks.hasToken = true;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(getDatasetRecommendations).toHaveBeenCalledTimes(1);
  });

  // An expired token also answers 401; the refreshed one may be let in.
  it("asks once more with a refreshed token after a no-access answer", async () => {
    getDatasetRecommendations.mockResolvedValue({ status: "noAccess" });
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await screen.findByText(
      "Recommendations are shown only for datasets you have access to.",
    );

    const refreshed = vi
      .fn()
      .mockResolvedValue(datasets({ id: "r1", name: "Alpha Dataset" }));
    mocks.current = refreshed;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(refreshed).toHaveBeenCalledWith("d1");
  });

  it("asks once more when the token refreshes while a refused request is out", async () => {
    const first = pending();
    getDatasetRecommendations.mockReturnValue(first.promise);
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );

    const refreshed = vi
      .fn()
      .mockResolvedValue(datasets({ id: "r1", name: "Alpha Dataset" }));
    mocks.current = refreshed;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {
      first.resolve({ status: "noAccess" });
      await first.promise;
    });

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(refreshed).toHaveBeenCalledWith("d1");
  });

  it("tries the newest token when another refresh comes during the retry", async () => {
    const first = pending();
    getDatasetRecommendations.mockReturnValue(first.promise);
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );

    const retry = pending();
    const second = vi.fn().mockReturnValue(retry.promise);
    mocks.current = second;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {
      first.resolve({ status: "noAccess" });
      await first.promise;
    });
    expect(second).toHaveBeenCalledTimes(1);

    const third = vi
      .fn()
      .mockResolvedValue(datasets({ id: "r1", name: "Alpha Dataset" }));
    mocks.current = third;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {
      retry.resolve({ status: "noAccess" });
      await retry.promise;
    });

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(third).toHaveBeenCalledTimes(1);
  });

  it("keeps the no-access note when the refreshed token is refused too", async () => {
    const note =
      "Recommendations are shown only for datasets you have access to.";
    getDatasetRecommendations.mockResolvedValue({ status: "noAccess" });
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await screen.findByText(note);

    const refreshed = vi.fn().mockResolvedValue({ status: "noAccess" });
    mocks.current = refreshed;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {});
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {});

    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(getDatasetRecommendations).toHaveBeenCalledTimes(1);
    expect(announced()).toEqual([note]);
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

  it("shows the collection chip and the licence chip", async () => {
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
    expect(chips.children).toHaveLength(2);
    expect(within(chips).getByText("Meteo")).toBeVisible();
    expect(within(chips).getByText("CC BY 4.0")).toBeVisible();
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
