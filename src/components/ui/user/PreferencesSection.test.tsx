import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PreferencesSection from "./PreferencesSection";

const baseNotifications = {
  newFeatures: { email: false, inApp: false },
  datasetLibraryChanges: { email: false, inApp: false },
  newDatasets: { email: false, inApp: false },
  systemMaintenance: { email: false, inApp: false },
  systemErrors: { email: false, inApp: false },
};

describe("PreferencesSection", () => {
  it("renders header and rows", () => {
    render(
      <PreferencesSection
        notifications={baseNotifications}
        updateNotification={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Group permissions")).toBeInTheDocument();
    expect(screen.getByText("New Features")).toBeInTheDocument();
    expect(screen.getByText("Dataset Library Changes")).toBeInTheDocument();
  });

  it("toggles email switch", () => {
    const updateNotification = vi.fn();
    render(
      <PreferencesSection
        notifications={baseNotifications}
        updateNotification={updateNotification}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByLabelText("New Features email"));

    expect(updateNotification).toHaveBeenCalledWith(
      "newFeatures",
      "email",
      true,
    );
  });
});
