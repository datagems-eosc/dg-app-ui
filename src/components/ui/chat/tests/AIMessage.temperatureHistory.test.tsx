import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationMessage } from "@/app/chat/page";
import {
  parseConversationMessage,
  parseSearchInDataExploreResponse,
} from "@/lib/messageUtils";
import { athensTimeResponse } from "@/lib/temperatureAnswer/fixtures/observed";
import type { Message } from "@/types/chat";
import { AIMessage } from "../AIMessage";

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: () => false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn(function MockMap() {
      return {
        on: vi.fn(),
        project: vi.fn(() => ({ x: 0, y: 0 })),
        remove: vi.fn(),
      };
    }),
  },
}));

const fresh = parseSearchInDataExploreResponse(athensTimeResponse, [
  "dataset-1",
]) as Message;

const reopened = parseConversationMessage(
  {
    id: "m-1",
    kind: 3,
    createdAt: "2026-11-24T20:26:24Z",
    data: { kind: 3, payload: athensTimeResponse.result },
  } as unknown as ConversationMessage,
  0,
);

const visibleAnswer = () => {
  const panel = screen.getByTestId("temperature-panel-title");
  const table = screen.queryByRole("table");
  return {
    title: panel.textContent,
    points: document.querySelectorAll("[data-point]").length,
    location: screen.getByTestId("query-location-caption").textContent,
    rows: table ? within(table).getAllByRole("row").length : 0,
  };
};

describe("temperature answers in new and reopened conversations", () => {
  it("parses the same table and SQL both ways", () => {
    expect(reopened.tableData).toEqual(fresh.tableData);
    expect(reopened.sqlQuery).toBe(fresh.sqlQuery);
  });

  it("shows the same panel, points and location both ways", () => {
    const { unmount } = render(<AIMessage message={fresh} />);
    const first = visibleAnswer();
    unmount();

    render(<AIMessage message={reopened} />);
    expect(visibleAnswer()).toEqual(first);
    expect(first).toMatchObject({
      title: "Avg tmean (°C) · 31 rows · 1 Jul 2020 – 31 Jul 2020",
      points: 31,
      location: "Query location 38.0, 23.7",
    });
  });
});
