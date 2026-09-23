import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseApi = vi.fn();
const mockUseCollections = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => mockUseCollections(),
}));

import { Classification } from "./Classification";

const data = {
  fieldsOfScience: [],
  collection: "",
  license: "",
  languages: [],
  countries: [],
};

const renderClassification = (props: { showCollection?: boolean } = {}) =>
  render(
    <Classification
      data={data}
      onChange={vi.fn()}
      errors={{}}
      {...(props.showCollection === undefined
        ? {}
        : { showCollection: props.showCollection })}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockUseApi.mockReturnValue({
    hasToken: true,
    getFieldsOfScience: vi.fn().mockResolvedValue([]),
    getLicenses: vi.fn().mockResolvedValue([]),
  });
  mockUseCollections.mockReturnValue({
    apiCollections: [{ id: "collection-1", name: "Weather", code: "weather" }],
    isLoadingApiCollections: false,
  });
});

describe("Classification collection visibility", () => {
  it("offers the collection selector by default, for existing consumers", async () => {
    renderClassification();

    await waitFor(() => {
      expect(screen.getByText("Collection")).toBeInTheDocument();
    });
    // `""` resolves to the explicit "No collection" option, not the placeholder.
    expect(screen.getByText("No collection")).toBeInTheDocument();
  });

  it("hides only the collection selector when a caller opts out", async () => {
    renderClassification({ showCollection: false });

    await waitFor(() => {
      expect(screen.getByText("License")).toBeInTheDocument();
    });

    expect(screen.queryByText("Collection")).not.toBeInTheDocument();
    expect(screen.queryByText("No collection")).not.toBeInTheDocument();
    // The collection name itself must not be reachable through the control.
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();

    // Everything else the section owns is still there.
    expect(screen.getByText(/Field of Science/)).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("Country")).toBeInTheDocument();
  });
});
