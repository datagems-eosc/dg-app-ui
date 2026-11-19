import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logWarn: vi.fn() }));

import { logWarn } from "@/lib/logger";
import {
  parseConversationMessage,
  parseSearchInDataExploreResponse,
} from "./messageUtils";

/**
 * UI #375: when the generated SQL fails to run, the Gateway still answers
 * HTTP 200, with `status` 1 (Error, a numeric enum in dg-app-api
 * InDataExplorationBuilder) and a "none" result entry carrying the service's
 * technical message.
 */
const REPHRASE =
  "This question can't be answered from the selected data. Try rephrasing it.";

const failedAnswer = (message?: string) => ({
  result: {
    question: "qwzx vbnm plok",
    status: 1,
    entries: [
      {
        status: 1,
        process: { sql: { query: "SELECT * FROM t WHERE x = 'qwzx'" } },
        result: message === undefined ? {} : { message },
      },
    ],
  },
});

describe("parseSearchInDataExploreResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["with the service's message", 'column "x" does not exist'],
    ["without a message", undefined],
  ])("shows the rephrase message for a failed SQL run (%s)", (_, message) => {
    const parsed = parseSearchInDataExploreResponse(failedAnswer(message), [
      "d-1",
    ]);

    expect(parsed?.content).toBe(REPHRASE);
    expect(parsed?.tableData).toBeUndefined();
    expect(parsed?.content).not.toContain("does not exist");
  });

  it("logs the technical message instead of showing it", () => {
    parseSearchInDataExploreResponse(
      failedAnswer('column "x" does not exist'),
      ["d-1"],
    );

    expect(logWarn).toHaveBeenCalledWith(
      "In-data answer failed",
      expect.objectContaining({ message: 'column "x" does not exist' }),
    );
  });

  it("accepts the status as text too", () => {
    const answer = failedAnswer();
    const parsed = parseSearchInDataExploreResponse(
      { result: { ...answer.result, status: "Error" } },
      ["d-1"],
    );

    expect(parsed?.content).toBe(REPHRASE);
  });

  it("shows the rephrase message for a stored failed answer", () => {
    const stored = {
      id: "m-2",
      kind: 3,
      createdAt: "2026-11-19T10:00:00Z",
      data: { kind: 3, payload: failedAnswer("syntax error").result },
    } as unknown as Parameters<typeof parseConversationMessage>[0];

    const parsed = parseConversationMessage(stored, 1);

    expect(parsed.content).toBe(REPHRASE);
    expect(parsed.tableData).toBeUndefined();
  });

  it("renders a successful table answer as before", () => {
    const table = {
      columns: [{ columnNumber: 0, name: "rain" }],
      rows: [{ rowNumber: 0, cells: [{ column: "rain", value: 12 }] }],
    };
    const parsed = parseSearchInDataExploreResponse(
      { result: { status: 0, entries: [{ status: 0, result: { table } }] } },
      ["d-1"],
    );

    expect(parsed?.content).toBe("Table Results:\n");
    expect(parsed?.tableData).toEqual(table);
    expect(logWarn).not.toHaveBeenCalled();
  });
});
