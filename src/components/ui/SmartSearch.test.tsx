import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SmartSearch from "./SmartSearch";

describe("SmartSearch – description follows the toggle", () => {
  it("describes content analysis when Smart search is on", () => {
    render(<SmartSearch enabled />);

    expect(screen.getByText("Smart search")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Analyzes dataset contents to help you find what you're looking for",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Searches dataset metadata by keyword"),
    ).toBeNull();
  });

  it("describes the keyword metadata search when Smart search is off", () => {
    render(<SmartSearch enabled={false} />);

    expect(screen.getByText("Smart search")).toBeInTheDocument();
    expect(
      screen.getByText("Searches dataset metadata by keyword"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Analyzes dataset contents to help you find what you're looking for",
      ),
    ).toBeNull();
  });
});
