import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import { FeatureFlagsManager } from "./FeatureFlagsManager";

const renderManager = () =>
  render(
    <FeatureFlagsProvider>
      <FeatureFlagsManager />
    </FeatureFlagsProvider>,
  );

describe("FeatureFlagsManager", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__env = { DEPLOYMENT_ENV: "playground" };
  });

  it("renders a row for every registered feature flag", () => {
    renderManager();
    expect(
      screen.getByRole("heading", { name: "Feature flags" }),
    ).toBeInTheDocument();
    for (const flag of FEATURE_FLAGS) {
      expect(screen.getByText(flag.label)).toBeInTheDocument();
    }
  });

  it("persists an override when a row is edited and saved", async () => {
    renderManager();

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Dataset packaging" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dataset packaging" }),
    ); // playground default true -> false
    await userEvent.click(
      screen.getByRole("button", { name: "Save Dataset packaging" }),
    );

    expect(
      JSON.parse(
        window.localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({ datasetPackage: false });
  });
});
