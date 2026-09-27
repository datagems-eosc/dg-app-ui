import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import TabsHeader from "./TabsHeader";

const renderTabs = (activeTab: "personal" | "notifications" | "roles") =>
  render(
    <FeatureFlagsProvider>
      <TabsHeader activeTab={activeTab} setActiveTab={vi.fn()} />
    </FeatureFlagsProvider>,
  );

describe("TabsHeader", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders only supported tabs", () => {
    renderTabs("personal");

    expect(screen.getByText("Personal settings")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
  });

  it("invokes setActiveTab on click", () => {
    const setActiveTab = vi.fn();
    render(
      <FeatureFlagsProvider>
        <TabsHeader activeTab="personal" setActiveTab={setActiveTab} />
      </FeatureFlagsProvider>,
    );

    fireEvent.click(screen.getByText("Notifications"));

    expect(setActiveTab).toHaveBeenCalledWith("notifications");
  });

  it("hides the Notifications tab when the notification flag is off", () => {
    window.localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify({ notification: false }),
    );

    renderTabs("personal");

    expect(screen.getByText("Notifications").closest("button")).toHaveClass(
      "hidden",
    );
    expect(
      screen.getByText("Personal settings").closest("button"),
    ).not.toHaveClass("hidden");
  });
});
