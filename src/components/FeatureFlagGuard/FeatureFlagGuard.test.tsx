import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import { FeatureFlagGuard } from "./FeatureFlagGuard";

const setFlagOverride = (datasetPackage: boolean) =>
  window.localStorage.setItem(
    FEATURE_FLAGS_STORAGE_KEY,
    JSON.stringify({ datasetPackage }),
  );

describe("FeatureFlagGuard", () => {
  beforeEach(() => {
    replace.mockClear();
    window.localStorage.clear();
  });

  it("renders children when the flag is enabled", async () => {
    setFlagOverride(true);
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="datasetPackage">
          <p>visible</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    expect(await screen.findByText("visible")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("hides children and redirects once hydrated when the flag is disabled", async () => {
    setFlagOverride(false);
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="datasetPackage" redirectTo="/dashboard">
          <p>secret</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });
});
