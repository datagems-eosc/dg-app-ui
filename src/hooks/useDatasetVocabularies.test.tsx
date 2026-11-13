import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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

const isSettled = (state: {
  isLoadingFieldsOfScience: boolean;
  isLoadingLicenses: boolean;
}) => !state.isLoadingFieldsOfScience && !state.isLoadingLicenses;

describe("useDatasetVocabularies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.hasToken = true;
    api.getFieldsOfScience.mockResolvedValue(FIELDS);
    api.getLicenses.mockResolvedValue(LICENSES);
  });

  it("loads fields of science and licences once, ready for the filters", async () => {
    const { result } = renderHook(() => useDatasetVocabularies());

    expect(isSettled(result.current)).toBe(false);
    await waitFor(() => expect(isSettled(result.current)).toBe(true));

    expect(result.current.licenses.map((l) => l.value)).toEqual(LICENSES);
    expect(result.current.fieldsOfScienceCategories.length).toBeGreaterThan(0);
    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when the caller re-renders", async () => {
    const { result, rerender } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(isSettled(result.current)).toBe(true));

    rerender();
    rerender();

    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when a token refresh renews the API calls", async () => {
    const { result, rerender } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(isSettled(result.current)).toBe(true));
    const firstFields = api.getFieldsOfScience;
    const firstLicenses = api.getLicenses;

    // useApi rebuilds its calls when the access token changes.
    api.getFieldsOfScience = vi.fn().mockResolvedValue(FIELDS);
    api.getLicenses = vi.fn().mockResolvedValue(LICENSES);
    rerender();

    expect(firstFields).toHaveBeenCalledTimes(1);
    expect(firstLicenses).toHaveBeenCalledTimes(1);
    expect(api.getFieldsOfScience).not.toHaveBeenCalled();
    expect(api.getLicenses).not.toHaveBeenCalled();
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

    await waitFor(() => expect(isSettled(result.current)).toBe(true));
    expect(result.current.fieldsOfScienceCategories).toEqual([]);
    expect(result.current.licenses.map((l) => l.value)).toEqual(LICENSES);
  });

  it("asks again only for a vocabulary that failed", async () => {
    api.getFieldsOfScience.mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(isSettled(result.current)).toBe(true));

    act(() => result.current.retryFailed());

    await waitFor(() =>
      expect(result.current.fieldsOfScienceCategories.length).toBeGreaterThan(
        0,
      ),
    );
    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(2);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });

  it("keeps the loaded vocabulary listed while a failed one is retried", async () => {
    api.getLicenses.mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(isSettled(result.current)).toBe(true));
    api.getLicenses.mockReturnValueOnce(new Promise(() => {}));

    act(() => result.current.retryFailed());

    expect(result.current.isLoadingLicenses).toBe(true);
    expect(result.current.isLoadingFieldsOfScience).toBe(false);
  });

  it("asks once per failed vocabulary after a StrictMode double mount", async () => {
    api.getLicenses.mockRejectedValueOnce(new Error("down"));
    api.getLicenses.mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useDatasetVocabularies(), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(api.getLicenses).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(isSettled(result.current)).toBe(true));

    act(() => result.current.retryFailed());

    await waitFor(() => expect(result.current.licenses.length).toBe(2));
    expect(api.getLicenses).toHaveBeenCalledTimes(3);
  });

  it("asks for nothing again when every vocabulary loaded", async () => {
    const { result } = renderHook(() => useDatasetVocabularies());
    await waitFor(() => expect(isSettled(result.current)).toBe(true));

    act(() => result.current.retryFailed());

    expect(api.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(api.getLicenses).toHaveBeenCalledTimes(1);
  });
});
