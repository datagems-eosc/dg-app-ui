import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import { FeatureFlagsProvider, useFeatureFlags } from "./FeatureFlagsContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
);

describe("FeatureFlagsContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__env = { DEPLOYMENT_ENV: "playground" };
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("resolves a flag to its environment default when no override exists", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    expect(result.current.flags.datasetPackage).toBe(true);
    expect(result.current.environment).toBe("playground");
  });

  it("setOverride updates the resolved value and persists to localStorage", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => {
      result.current.setOverride("datasetPackage", false);
    });

    expect(result.current.flags.datasetPackage).toBe(false);
    expect(
      JSON.parse(
        window.localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY) ?? "{}",
      ),
    ).toEqual({ datasetPackage: false });
  });

  it("loads persisted overrides from localStorage on mount", async () => {
    window.localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify({ datasetPackage: false }),
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => {
      expect(result.current.flags.datasetPackage).toBe(false);
    });
  });

  it("useFeatureFlags throws outside of a provider", () => {
    expect(() => renderHook(() => useFeatureFlags())).toThrow();
  });
});
