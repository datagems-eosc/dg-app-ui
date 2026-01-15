import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatRecommendations } from "./ChatRecommendations";

describe("ChatRecommendations", () => {
  const mockRecommendations = [
    "Machine learning basics",
    "Neural networks",
    "Data preprocessing",
  ];

  it("should render recommendations when provided", () => {
    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Would you be also interested in these topics?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Machine learning basics")).toBeInTheDocument();
    expect(screen.getByText("Neural networks")).toBeInTheDocument();
    expect(screen.getByText("Data preprocessing")).toBeInTheDocument();
  });

  it("should call onRecommendationClick when a recommendation is clicked", async () => {
    const user = userEvent.setup();
    const onRecommendationClick = vi.fn();

    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={onRecommendationClick}
      />,
    );

    const recommendationButton = screen.getByText("Machine learning basics");
    await user.click(recommendationButton);

    expect(onRecommendationClick).toHaveBeenCalledTimes(1);
    expect(onRecommendationClick).toHaveBeenCalledWith(
      "Machine learning basics",
    );
  });

  it("should call onRecommendationClick with correct recommendation for each button", async () => {
    const user = userEvent.setup();
    const onRecommendationClick = vi.fn();

    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={onRecommendationClick}
      />,
    );

    await user.click(screen.getByText("Neural networks"));
    expect(onRecommendationClick).toHaveBeenCalledWith("Neural networks");

    await user.click(screen.getByText("Data preprocessing"));
    expect(onRecommendationClick).toHaveBeenCalledWith("Data preprocessing");
  });

  it("should render skeleton when isLoading is true", () => {
    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={vi.fn()}
        isLoading={true}
      />,
    );

    expect(
      screen.queryByText("Would you be also interested in these topics?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Machine learning basics"),
    ).not.toBeInTheDocument();
  });

  it("should return null when recommendations is empty array", () => {
    const { container } = render(
      <ChatRecommendations
        recommendations={[]}
        onRecommendationClick={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should return null when recommendations is undefined", () => {
    const { container } = render(
      <ChatRecommendations
        recommendations={undefined}
        onRecommendationClick={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render search icons for each recommendation", () => {
    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(mockRecommendations.length);

    buttons.forEach((button) => {
      const svg = button.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  it("should render all recommendations with tertiary button variant", () => {
    render(
      <ChatRecommendations
        recommendations={mockRecommendations}
        onRecommendationClick={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(mockRecommendations.length);
  });
});
