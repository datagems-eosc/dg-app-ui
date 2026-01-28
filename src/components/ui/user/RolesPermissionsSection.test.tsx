import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RolesPermissionsSection from "./RolesPermissionsSection";

describe("RolesPermissionsSection", () => {
  it("renders headers and table rows", () => {
    render(<RolesPermissionsSection />);

    expect(screen.getByText("User Access")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Dataset name")).toBeInTheDocument();
    expect(
      screen.getByText("Hurricane Evacuation Data (2005-2023)"),
    ).toBeInTheDocument();
  });
});
