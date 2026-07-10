import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { writeOverrides } from "@/lib/featureFlags/storage";
import { FeatureFlagGuard } from "./FeatureFlagGuard";

describe("FeatureFlagGuard", () => {
  beforeEach(() => {
    replace.mockClear();
    window.localStorage.clear();
  });

  it("renders children when the flag is enabled", () => {
    window.__env = { DEPLOYMENT_ENV: "playground" }; // datasetPackage default true
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="datasetPackage">
          <p>visible</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("hides children and redirects once hydrated when the flag is disabled", async () => {
    window.__env = { DEPLOYMENT_ENV: "staging" }; // customCollection default false
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="customCollection" redirectTo="/dashboard">
          <p>secret</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("inverted guard hides children and redirects when the flag is enabled", async () => {
    window.__env = { DEPLOYMENT_ENV: "production" }; // generalChat default true
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="generalChat" invert redirectTo="/dashboard">
          <p>general chat</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    expect(screen.queryByText("general chat")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("inverted guard renders children when the flag is overridden OFF", async () => {
    window.__env = { DEPLOYMENT_ENV: "production" };
    writeOverrides({ generalChat: false });
    render(
      <FeatureFlagsProvider>
        <FeatureFlagGuard flag="generalChat" invert>
          <p>general chat</p>
        </FeatureFlagGuard>
      </FeatureFlagsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("general chat")).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
