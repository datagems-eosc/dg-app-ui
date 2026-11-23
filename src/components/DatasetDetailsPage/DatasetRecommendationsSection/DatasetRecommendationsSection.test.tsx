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
  const getDatasetFeatures = vi.fn();
  // What useApi hands out now; a new session token gives a new function.
  return {
    getDatasetRecommendations,
    getDatasetFeatures,
    current: getDatasetRecommendations,
    hasToken: true,
  };
});
const { getDatasetRecommendations, getDatasetFeatures } = mocks;
const mockPush = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    getDatasetRecommendations: mocks.current,
    getDatasetFeatures: mocks.getDatasetFeatures,
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

/** Each request gets the signal that cancels it. */
const withSignal = { signal: expect.any(AbortSignal) };

/** What every live region currently holds. */
const announced = () =>
  screen.getAllByRole("status").map((element) => element.textContent);

beforeEach(() => {
  getDatasetRecommendations.mockReset();
  // Feature status unknown unless a test says otherwise: ask as before.
  getDatasetFeatures.mockReset().mockResolvedValue(null);
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
    expect(getDatasetRecommendations).toHaveBeenCalledWith("d1", withSignal);
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
      // In the shared notice box, not a box of its own.
      expect(screen.getByTestId("notice")).toHaveTextContent(note);
      expect(
        screen.getByRole("heading", { name: "Recommended datasets" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
      expect(announced()).toEqual([note]);
    },
  );
});

describe("DatasetRecommendationsSection — feature status", () => {
  const notKnownNote =
    "Recommendations are not available for this dataset yet.";

  it("does not ask the recommender about a dataset it does not know", async () => {
    getDatasetFeatures.mockResolvedValue({ recommendation: false });

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(await screen.findByText(notKnownNote)).toBeInTheDocument();
    expect(getDatasetFeatures).toHaveBeenCalledWith("d1", withSignal);
    expect(getDatasetRecommendations).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Recommended datasets" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
    expect(announced()).toEqual([notKnownNote]);
  });

  it.each<[string, unknown]>([
    ["says the recommender knows it", { recommendation: true }],
    ["has no recommendation flag", { profiled: true, packaged: false }],
    ["cannot be read (refused, failed, no session)", null],
  ])("asks the recommender when the feature status %s", async (_, features) => {
    getDatasetFeatures.mockResolvedValue(features);
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset" }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(getDatasetRecommendations).toHaveBeenCalledWith("d1", withSignal);
    expect(screen.queryByText(notKnownNote)).toBeNull();
  });

  it("keeps loading, without a note, while the feature status is read", async () => {
    getDatasetFeatures.mockReturnValue(new Promise(() => {}));

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await act(async () => {});

    expect(screen.getAllByTestId("recommendation-placeholder")).toHaveLength(6);
    expect(announced()).toContain("Finding similar datasets");
    expect(screen.queryByText(notKnownNote)).toBeNull();
    expect(getDatasetRecommendations).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "ignores the previous dataset's late feature status (recommendation: %s) after a dataset change",
    async (previous) => {
      let resolveFirst: (value: unknown) => void = () => {};
      getDatasetFeatures
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
        )
        .mockResolvedValueOnce({ recommendation: true });
      getDatasetRecommendations.mockResolvedValue(
        datasets({ id: "r2", name: "Second Answer" }),
      );

      const { rerender } = render(
        <DatasetRecommendationsSection datasetId="d1" />,
      );
      rerender(<DatasetRecommendationsSection datasetId="d2" />);
      await act(async () => {
        resolveFirst({ recommendation: previous });
      });

      expect(await screen.findByText("Second Answer")).toBeInTheDocument();
      expect(screen.queryByText(notKnownNote)).toBeNull();
      expect(getDatasetRecommendations).toHaveBeenCalledTimes(1);
      expect(getDatasetRecommendations).toHaveBeenCalledWith("d2", withSignal);
    },
  );
});

describe("DatasetRecommendationsSection — rejected request", () => {
  it("asks the recommender when the feature status request rejects", async () => {
    getDatasetFeatures.mockRejectedValue(new Error("boom"));
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset" }),
    );

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(await screen.findByText("Alpha Dataset")).toBeInTheDocument();
    expect(getDatasetRecommendations).toHaveBeenCalledWith("d1", withSignal);
  });

  it("shows the not-available note when the recommendations request rejects", async () => {
    getDatasetRecommendations.mockRejectedValue(new Error("boom"));

    render(<DatasetRecommendationsSection datasetId="d1" />);

    expect(
      await screen.findByText(
        "Recommendations are not available for this dataset right now.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
  });
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
    // d1's feature status arrives and its recommendations request goes out.
    await waitFor(() =>
      expect(getDatasetRecommendations).toHaveBeenCalledWith("d1", withSignal),
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
    expect(getDatasetRecommendations).toHaveBeenLastCalledWith(
      "d2",
      withSignal,
    );
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

describe("DatasetRecommendationsSection — cancellation", () => {
  /** The signal the nth call of a request mock was given. */
  const signalOf = (request: typeof getDatasetFeatures, call = 0) =>
    (request.mock.calls[call]?.[1] as { signal?: AbortSignal } | undefined)
      ?.signal;

  /** A request that never answers, and rejects like fetch when aborted. */
  const abortable = (_id: string, options?: { signal?: AbortSignal }) =>
    new Promise<never>((_, reject) => {
      options?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });

  it("cancels the running recommendations request when the page is left", async () => {
    getDatasetRecommendations.mockReturnValue(pending().promise);

    const { unmount } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await waitFor(() => expect(getDatasetRecommendations).toHaveBeenCalled());
    expect(signalOf(getDatasetRecommendations)?.aborted).toBe(false);
    unmount();

    expect(signalOf(getDatasetRecommendations)?.aborted).toBe(true);
  });

  it("does not cancel a request that has already answered", async () => {
    getDatasetRecommendations.mockResolvedValue(
      datasets({ id: "r1", name: "Alpha Dataset", description: "desc" }),
    );

    const { unmount } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await waitFor(() =>
      expect(screen.getByText("Alpha Dataset")).toBeInTheDocument(),
    );
    unmount();

    expect(signalOf(getDatasetFeatures)?.aborted).toBe(false);
    expect(signalOf(getDatasetRecommendations)?.aborted).toBe(false);
  });

  it("cancels the previous dataset's feature status read on a dataset change", async () => {
    getDatasetFeatures
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(null);
    getDatasetRecommendations.mockReturnValue(pending().promise);

    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    expect(signalOf(getDatasetFeatures)?.aborted).toBe(false);
    rerender(<DatasetRecommendationsSection datasetId="d2" />);

    expect(signalOf(getDatasetFeatures)?.aborted).toBe(true);
    await waitFor(() =>
      expect(getDatasetRecommendations).toHaveBeenCalledWith("d2", withSignal),
    );
    expect(getDatasetRecommendations).not.toHaveBeenCalledWith(
      "d1",
      expect.anything(),
    );
  });

  it("cancels the previous dataset's recommendations request without a note", async () => {
    getDatasetRecommendations
      .mockImplementationOnce(abortable)
      .mockReturnValueOnce(pending().promise);

    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await waitFor(() => expect(getDatasetRecommendations).toHaveBeenCalled());
    rerender(<DatasetRecommendationsSection datasetId="d2" />);
    await act(async () => {});

    expect(signalOf(getDatasetRecommendations)?.aborted).toBe(true);
    expect(
      screen.queryByText(
        "Recommendations are not available for this dataset right now.",
      ),
    ).toBeNull();
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
    await waitFor(() =>
      expect(refreshed).toHaveBeenCalledWith("d2", withSignal),
    );
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
    expect(refreshed).toHaveBeenCalledWith("d1", withSignal);
  });

  // The token rotates every few minutes; a refused page must not flash the
  // loading state and announce the same refusal again each time.
  it("keeps the no-access note, not loading, while the refreshed token is tried", async () => {
    const note =
      "Recommendations are shown only for datasets you have access to.";
    getDatasetRecommendations.mockResolvedValue({ status: "noAccess" });
    const { rerender } = render(
      <DatasetRecommendationsSection datasetId="d1" />,
    );
    await screen.findByText(note);

    const refreshed = vi.fn().mockReturnValue(pending().promise);
    mocks.current = refreshed;
    rerender(<DatasetRecommendationsSection datasetId="d1" />);
    await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));

    expect(announced()).toEqual([note]);
    expect(screen.queryByTestId("recommendation-placeholder")).toBeNull();
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
    expect(refreshed).toHaveBeenCalledWith("d1", withSignal);
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
    // Built by hand: the mapper never sets `access`, so it has to be put on
    // the mapped dataset for this test to be able to fail.
    const mapped = mapApiDatasetToDataset({ id: "r1", name: "Alpha Dataset" });
    getDatasetRecommendations.mockResolvedValue({
      status: "datasets",
      datasets: [{ ...mapped, access: "Open Access" }],
    });

    render(<DatasetRecommendationsSection datasetId="d1" />);
    await screen.findByText("Alpha Dataset");

    expect(screen.queryByText("Open Access")).toBeNull();
  });
});
