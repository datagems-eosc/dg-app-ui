import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationMessage } from "../src/app/chat/page";
import {
  parseConversationMessage,
  parseSearchInDataExploreResponse,
} from "../src/lib/messageUtils";

const createMockConversationMessage = (
  overrides: Partial<ConversationMessage>,
): ConversationMessage => ({
  id: "test-id",
  kind: 0,
  data: {
    kind: 0,
    payload: {},
    version: "1.0",
  },
  createdAt: "2024-01-01T10:00:00Z",
  ...overrides,
});

test("parseConversationMessage - kind 0 (old user format) with query", () => {
  const msg = createMockConversationMessage({
    kind: 0,
    data: {
      kind: 0,
      payload: { query: "What is the weather?" },
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "user");
  assert.equal(result.content, "What is the weather?");
  assert.equal(result.id, "test-id");
  assert.equal(result.timestamp, "2024-01-01T10:00:00Z");
});

test("parseConversationMessage - kind 0 with empty query", () => {
  const msg = createMockConversationMessage({
    kind: 0,
    data: {
      kind: 0,
      payload: { query: "" },
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "user");
  assert.equal(result.content, "");
});

test("parseConversationMessage - kind 0 with array payload", () => {
  const msg = createMockConversationMessage({
    kind: 0,
    data: {
      kind: 0,
      payload: [] as any,
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "user");
  assert.equal(result.content, "");
});

test("parseConversationMessage - kind 1 (old AI format) with single dataset", () => {
  const msg = createMockConversationMessage({
    kind: 1,
    data: {
      kind: 1,
      payload: [
        {
          dataset: {
            id: "dataset-1",
            name: "Weather Data",
            code: "WEATHER",
          },
        },
      ],
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "ai");
  assert.equal(
    result.content,
    "Given your question, the following dataset might be useful: Weather Data",
  );
  assert.deepEqual(result.relatedDatasetIds, ["dataset-1"]);
  assert.equal(result.sources, 1);
});

test("parseConversationMessage - kind 1 with multiple datasets", () => {
  const msg = createMockConversationMessage({
    kind: 1,
    data: {
      kind: 1,
      payload: [
        {
          dataset: {
            id: "dataset-1",
            name: "Weather Data",
            code: "WEATHER",
          },
        },
        {
          dataset: {
            id: "dataset-2",
            name: "Temperature Data",
            code: "TEMP",
          },
        },
      ],
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "ai");
  assert.ok(
    result.content.includes(
      "Given your question, the following datasets might be useful",
    ),
  );
  assert.ok(result.content.includes("• Weather Data"));
  assert.ok(result.content.includes("• Temperature Data"));
  assert.deepEqual(result.relatedDatasetIds, ["dataset-1", "dataset-2"]);
  assert.equal(result.sources, 2);
});

test("parseConversationMessage - kind 2 (new user format) with question", () => {
  const msg = createMockConversationMessage({
    kind: 2,
    data: {
      kind: 2,
      payload: {
        question: "What is the temperature?",
        datasetIds: ["dataset-1", "dataset-2"],
      } as any,
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "user");
  assert.equal(result.content, "What is the temperature?");
  assert.deepEqual(result.datasetIds, ["dataset-1", "dataset-2"]);
});

test("parseConversationMessage - kind 2 with question but no datasetIds", () => {
  const msg = createMockConversationMessage({
    kind: 2,
    data: {
      kind: 2,
      payload: {
        question: "What is the temperature?",
      },
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "user");
  assert.equal(result.content, "What is the temperature?");
  assert.deepEqual(result.datasetIds, []);
});

test("parseConversationMessage - kind 3 (new AI format) with table data", () => {
  const msg = createMockConversationMessage({
    kind: 3,
    data: {
      kind: 3,
      payload: {
        entries: [
          {
            result: {
              table: {
                columns: [
                  { columnNumber: 1, name: "City" },
                  { columnNumber: 2, name: "Temperature" },
                ],
                rows: [
                  {
                    rowNumber: 1,
                    cells: [
                      { column: "City", value: "New York" },
                      { column: "Temperature", value: 72 },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "ai");
  assert.equal(result.content, "Table Results:\n");
  assert.ok(result.tableData);
  assert.equal(result.tableData?.columns.length, 2);
  assert.equal(result.tableData?.rows.length, 1);
});

test("parseConversationMessage - kind 3 with entries but no table", () => {
  const msg = createMockConversationMessage({
    kind: 3,
    data: {
      kind: 3,
      payload: {
        entries: [
          {
            result: {},
          },
        ],
      },
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "ai");
  assert.equal(result.content, "Analysis completed.");
});

test("parseConversationMessage - kind 3 with coordinates", () => {
  const msg = createMockConversationMessage({
    kind: 3,
    data: {
      kind: 3,
      payload: {
        data: {
          InputParams: [
            {
              lat: 40.7128,
              lon: -74.006,
            },
          ],
        },
        entries: [],
      } as any,
      version: "1.0",
    },
  });

  const result = parseConversationMessage(msg, 0);

  assert.equal(result.type, "ai");
  assert.equal(result.latitude, 40.7128);
  assert.equal(result.longitude, -74.006);
});

test("parseSearchInDataExploreResponse - returns message with table data", () => {
  const response = {
    result: {
      entries: [
        {
          result: {
            table: {
              columns: [
                { columnNumber: 1, name: "Name" },
                { columnNumber: 2, name: "Value" },
              ],
              rows: [
                {
                  rowNumber: 1,
                  cells: [
                    { column: "Name", value: "Test" },
                    { column: "Value", value: 100 },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  };

  const result = parseSearchInDataExploreResponse(response, ["dataset-1"]);

  assert.ok(result);
  assert.equal(result?.type, "ai");
  assert.equal(result?.content, "Table Results:\n");
  assert.ok(result?.tableData);
  assert.equal(result?.tableData?.columns.length, 2);
  assert.equal(result?.tableData?.rows.length, 1);
  assert.equal(result?.sources, 1);
  assert.deepEqual(result?.relatedDatasetIds, ["dataset-1"]);
});

test("parseSearchInDataExploreResponse - returns message without table data", () => {
  const response = {
    result: {
      entries: [
        {
          result: {},
        },
      ],
    },
  };

  const result = parseSearchInDataExploreResponse(response, []);

  assert.ok(result);
  assert.equal(result?.type, "ai");
  assert.equal(result?.content, "Analysis completed.");
  assert.equal(result?.tableData, undefined);
});

test("parseSearchInDataExploreResponse - extracts coordinates from InputParams", () => {
  const response = {
    result: {
      data: {
        InputParams: [
          {
            lat: 37.7749,
            lon: -122.4194,
          },
        ],
      },
      entries: [],
    },
  };

  const result = parseSearchInDataExploreResponse(response, []);

  assert.ok(result);
  assert.equal(result?.latitude, 37.7749);
  assert.equal(result?.longitude, -122.4194);
});

test("parseSearchInDataExploreResponse - sets timestamp to current date", () => {
  const response = {
    result: {
      entries: [],
    },
  };

  const before = new Date();
  const result = parseSearchInDataExploreResponse(response, []);
  const after = new Date();

  assert.ok(result);
  assert.ok(result.timestamp instanceof Date);
  assert.ok(result.timestamp.getTime() >= before.getTime());
  assert.ok(result.timestamp.getTime() <= after.getTime());
});

test("parseSearchInDataExploreResponse - handles multiple dataset IDs", () => {
  const response = {
    result: {
      entries: [],
    },
  };

  const result = parseSearchInDataExploreResponse(response, [
    "dataset-1",
    "dataset-2",
    "dataset-3",
  ]);

  assert.ok(result);
  assert.equal(result?.sources, 3);
  assert.deepEqual(result?.relatedDatasetIds, [
    "dataset-1",
    "dataset-2",
    "dataset-3",
  ]);
});
