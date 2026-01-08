import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatInitialView from "../ChatInitialView";

vi.mock("@ui/chat/DGIcon", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="dg-icon" className={className} aria-label="DataGems Icon">
      DG Icon
    </div>
  ),
}));

describe("ChatInitialView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the component with all required elements", () => {
    render(<ChatInitialView />);

    expect(screen.getByText("New Chat")).toBeInTheDocument();
    expect(
      screen.getByText("Ask your question based on added datasets"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dg-icon")).toBeInTheDocument();
  });

  it("should render the heading with correct semantic structure", () => {
    render(<ChatInitialView />);

    const heading = screen.getByRole("heading", { name: "New Chat", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("New Chat");
  });

  it("should render the description text", () => {
    render(<ChatInitialView />);

    const description = screen.getByText(
      "Ask your question based on added datasets",
    );
    expect(description).toBeInTheDocument();
    expect(description.tagName).toBe("P");
  });

  it("should render the DG icon", () => {
    render(<ChatInitialView />);

    const icon = screen.getByTestId("dg-icon");
    expect(icon).toBeInTheDocument();
  });

  it("should have accessible structure", () => {
    render(<ChatInitialView />);

    const heading = screen.getByRole("heading", { name: "New Chat" });
    expect(heading).toBeInTheDocument();

    const icon = screen.getByLabelText("DataGems Icon");
    expect(icon).toBeInTheDocument();
  });
});
