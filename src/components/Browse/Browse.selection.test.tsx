import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Browse from "./Browse";

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: false,
    getCollectionGrants: vi.fn(),
    getFieldsOfScience: vi.fn(),
    getLicenses: vi.fn(),
  }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: () => false,
}));

vi.mock("@/contexts/DatasetContext", () => ({
  useDataset: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [],
    extraCollections: [],
    refreshExtraCollections: vi.fn(),
    notifyCollectionModified: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/browse",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./useDatasetSearchExamples", () => ({
  useDatasetSearchExamples: () => [],
}));

// The panel hides its button without a selection; the stub keeps it, so the
// action can be used with nothing selected.
vi.mock("../SelectedDatasetsPanel", () => ({
  default: (props: { onAddToCollection?: () => void }) => (
    <button type="button" onClick={() => props.onAddToCollection?.()}>
      Add to collection
    </button>
  ),
}));

const datasets = [
  {
    id: "1",
    title: "Rainfall",
    description: "",
    category: "Math" as const,
    size: "1 MB",
    lastUpdated: "2024-01-01",
    tags: [],
  },
];

const MESSAGE = "Please select some datasets first";

describe("Browse – an action that needs selected datasets", () => {
  const alert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = alert;
  });

  const renderBrowse = (selected: string[], onAdd = vi.fn()) => {
    const view = (ids: string[]) => (
      <Browse
        datasets={datasets}
        title="Datasets"
        subtitle=""
        selectedDatasets={ids}
        onSelectedDatasetsChange={vi.fn()}
        showSelectedPanel
        onAddToCollection={onAdd}
      />
    );
    const utils = render(view(selected));
    return {
      ...utils,
      onAdd,
      rerenderWith: (ids: string[]) => utils.rerender(view(ids)),
    };
  };

  it("asks inline for a selection and does not run the action", async () => {
    const { onAdd } = renderBrowse([]);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE);
    expect(onAdd).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("runs the action with a selection and says nothing", async () => {
    const { onAdd } = renderBrowse(["1"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it("drops the message once a dataset is selected, and the action works", async () => {
    const { onAdd, rerenderWith } = renderBrowse([]);
    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();

    act(() => rerenderWith(["1"]));

    expect(screen.queryByText(MESSAGE)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("does not ask again after the user selects and then clears the selection", async () => {
    const { rerenderWith } = renderBrowse([]);
    await userEvent.click(
      screen.getByRole("button", { name: "Add to collection" }),
    );

    act(() => rerenderWith(["1"]));
    act(() => rerenderWith([]));

    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
