import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/chat";
import { AIMessage } from "../AIMessage";

const flags = vi.hoisted(() => ({
  datasetRecommendation: true,
  questionRecommendation: true,
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: keyof typeof flags) => flags[id] ?? false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@ui/chat/AIMessageHeader", () => ({
  AIMessageHeader: () => <div data-testid="ai-message-header">Header</div>,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("shows Sources in a row under the answer", () => {
    render(<AIMessage message={{ ...defaultMessage, sources: 3 }} />);

    const sources = screen.getByRole("button", { name: "3 Sources" });
    const content = screen.getByTestId("ai-message-content");
    expect(
      content.compareDocumentPosition(sources) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the sources from the row under the answer", async () => {
    const user = userEvent.setup();
    const onSourcesClick = vi.fn();
    render(
      <AIMessage
        message={{ ...defaultMessage, sources: 2 }}
        onSourcesClick={onSourcesClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "2 Sources" }));

    expect(onSourcesClick).toHaveBeenCalledTimes(1);
  });

  it("shows no Sources row on a dataset proposal", () => {
    render(
      <AIMessage
        message={{
          ...defaultMessage,
          sources: 2,
          datasetProposal: [
            { id: "d1", title: "Rainfall" },
            { id: "d2", title: "Stations" },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Open dataset Rainfall" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sources?$/i }),
    ).not.toBeInTheDocument();
  });

  it("places the suggestions after the Sources row", () => {
    render(
      <AIMessage
        isLastAIMessage
        message={{
          ...defaultMessage,
          sources: 1,
          recommendations: ["Monthly rainfall"],
        }}
      />,
    );

    const sources = screen.getByRole("button", { name: "1 Source" });
    const suggestion = screen.getByRole("button", {
      name: /monthly rainfall/i,
    });
    expect(
      sources.compareDocumentPosition(suggestion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should render temperature map for messages with coordinates", () => {
    render(<AIMessage message={defaultMessage} />);

    expect(screen.getByTestId("temperature-map")).toBeInTheDocument();
  });
});
