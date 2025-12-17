import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/chat";
import { AIMessage } from "../AIMessage";

vi.mock("@ui/chat/AIMessageHeader", () => ({
  AIMessageHeader: ({
    sources,
    onSourcesClick,
  }: {
    sources?: number;
    onSourcesClick?: () => void;
  }) => (
    <div
      data-testid="ai-message-header"
      data-sources={sources}
      onClick={onSourcesClick}
    >
      Header
    </div>
  ),
}));

vi.mock("@ui/chat/TemperatureMap", () => ({
  TemperatureMap: () => (
    <div data-testid="temperature-map">Temperature Map</div>
  ),
}));

vi.mock("@ui/chat/AIMessageContent", () => ({
  AIMessageContent: ({
    content,
    tableData,
  }: {
    content: string;
    tableData?: unknown;
  }) => (
    <div data-testid="ai-message-content">
      {content}
      {tableData ? <span data-testid="has-table-data">Has table</span> : null}
    </div>
  ),
}));

describe("AIMessage", () => {
  const defaultMessage: Message = {
    id: "1",
    type: "ai",
    content: "Test content",
    timestamp: new Date().toISOString(),
    latitude: 10,
    longitude: 20,
  };

  it("should render header, temperature map and content", () => {
    render(<AIMessage message={defaultMessage} />);

    expect(screen.getByTestId("ai-message-header")).toBeInTheDocument();
    expect(screen.getByTestId("temperature-map")).toBeInTheDocument();
    expect(screen.getByTestId("ai-message-content")).toHaveTextContent(
      "Test content",
    );
  });

  it("should render message content correctly", () => {
    const message: Message = {
      ...defaultMessage,
      content: "Custom message content",
    };

    render(<AIMessage message={message} />);

    expect(screen.getByText("Custom message content")).toBeInTheDocument();
  });

  it("should pass tableData to AIMessageContent when provided", () => {
    const messageWithTable: Message = {
      ...defaultMessage,
      tableData: {
        columns: [{ columnNumber: 1, name: "A" }],
        rows: [
          {
            rowNumber: 1,
            cells: [{ column: "A", value: "1" }],
          },
        ],
      },
    };

    render(<AIMessage message={messageWithTable} />);

    expect(screen.getByTestId("has-table-data")).toBeInTheDocument();
  });

  it("should pass sources to header when provided", () => {
    const messageWithSources: Message = {
      ...defaultMessage,
      sources: 3,
    };

    render(<AIMessage message={messageWithSources} />);

    const header = screen.getByTestId("ai-message-header");
    expect(header).toHaveAttribute("data-sources", "3");
  });

  it("should call onSourcesClick when header sources button is clicked", async () => {
    const user = userEvent.setup();
    const onSourcesClick = vi.fn();
    const messageWithSources: Message = {
      ...defaultMessage,
      sources: 2,
    };

    render(
      <AIMessage
        message={messageWithSources}
        onSourcesClick={onSourcesClick}
      />,
    );

    const header = screen.getByTestId("ai-message-header");
    await user.click(header);

    expect(onSourcesClick).toHaveBeenCalledTimes(1);
  });

  it("should render temperature map for messages with coordinates", () => {
    render(<AIMessage message={defaultMessage} />);

    expect(screen.getByTestId("temperature-map")).toBeInTheDocument();
  });
});
