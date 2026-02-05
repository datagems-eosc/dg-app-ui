import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXTERNAL_URLS } from "@/config/appUrls";
import PersonalSettingsSection from "./PersonalSettingsSection";

describe("PersonalSettingsSection", () => {
  it("renders account management action", () => {
    render(
      <PersonalSettingsSection
        formData={{ name: "Jane", surname: "Doe" }}
        userData={{ name: "Jane", surname: "Doe", email: "jane@doe.com" }}
      />,
    );

    expect(screen.getByText("Account management")).toBeInTheDocument();
    expect(screen.getByText("Open account settings")).toBeInTheDocument();
    expect(screen.queryByText("Delete Account")).toBeNull();
  });

  it("opens AAI account management", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <PersonalSettingsSection
        formData={{ name: "Jane", surname: "Doe" }}
        userData={{ name: "Jane", surname: "Doe", email: "jane@doe.com" }}
      />,
    );

    fireEvent.click(screen.getByText("Open account settings"));

    expect(openSpy).toHaveBeenCalledWith(
      EXTERNAL_URLS.AAI_ACCOUNT,
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });
});
