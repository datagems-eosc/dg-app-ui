import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDatasetVocabularies } from "./useDatasetVocabularies";

const api = {
  hasToken: true,
  getFieldsOfScience: vi.fn(),
  getLicenses: vi.fn(),
};

// useApi returns a new object on every render, as the real hook does.
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ ...api }) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const FIELDS = {
  hierarchy: [
    {
      code: "1",
      name: "Natural sciences",
      children: [{ code: "1.1", name: "Mathematics" }],
    },
  ],
};
const LICENSES = ["MIT", "CC-BY-4.0"];

describe("useDatasetVocabularies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.hasToken = true;
    api.getFieldsOfScience.mockResolvedValue(FIELDS);
    api.getLicenses.mockResolvedValue(LICENSES);
  });

  it("loads fields of science and licences once, ready for the filters", async () => {
    const { result } = renderHook(() => useDatasetVocabularies());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.licenses.map((l) => l.value)).toEqual(LICENSES);
    expect(result.current.fieldsOfScienceCategories.length).toBeGreaterThan(0);
    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when the caller re-renders", async () => {
    const { result, rerender } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    rerender();

    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing while signed out", () => {
    api.hasToken = false;

    renderHook(() => useDatasetVocabularies());

    expect(api.getFieldsOfScience).not.toHaveBeenCalled();
    expect(api.getLicenses).not.toHaveBeenCalled();
  });

  it("leaves a vocabulary empty when it fails and keeps the other", async () => {
    api.getFieldsOfScience.mockRejectedValue(new Error("down"));

    const { result } = renderHook(() => useDatasetVocabularies());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fieldsOfScienceCategories).toEqual([]);
    expect(result.current.licenses.map((l) => l.value)).toEqual(LICENSES);
  });
});
