import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TabsHeader from "./TabsHeader";

describe("TabsHeader", () => {
  it("renders only supported tabs", () => {
    render(<TabsHeader activeTab="personal" setActiveTab={vi.fn()} />);

    expect(screen.getByText("Personal settings")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
  });

  it("invokes setActiveTab on click", () => {
    const setActiveTab = vi.fn();
    render(<TabsHeader activeTab="personal" setActiveTab={setActiveTab} />);

    fireEvent.click(screen.getByText("Notifications"));

    expect(setActiveTab).toHaveBeenCalledWith("notifications");
  });
});
