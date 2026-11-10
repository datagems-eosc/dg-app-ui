import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AIMessageHeader } from "../AIMessageHeader";

describe("AIMessageHeader", () => {
  it("names the reply DataGEMS next to the gem mark", () => {
    const { container } = render(<AIMessageHeader />);

    expect(screen.getByText("DataGEMS")).toBeInTheDocument();
    expect(screen.queryByText("DataGems AI")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("holds no Sources or Download actions", () => {
    render(<AIMessageHeader />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
