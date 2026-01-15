import assert from "node:assert/strict";
import test from "node:test";
import {
  detectNewAIMessages,
  mergeMessages,
} from "../src/lib/messageMergeUtils";
import type { Message } from "../src/types/chat";

test("mergeMessages - should return server messages when no local messages exist", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
    {
      id: "server-2",
      type: "ai",
      content: "Hi there",
      timestamp: new Date("2024-01-01T10:00:01"),
    },
  ];

  const result = mergeMessages(serverMessages, []);
  assert.deepEqual(result, serverMessages);
});

test("mergeMessages - should remove local messages that have server duplicates", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
    {
      id: "server-2",
      type: "ai",
      content: "Hi there",
      timestamp: new Date("2024-01-01T10:00:01"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1", // Different ID but same content
      type: "user",
      content: "Hello", // Same content
      timestamp: new Date("2024-01-01T10:00:00"), // Same timestamp
    },
    {
      id: "local-2",
      type: "ai",
      content: "Hi there",
      timestamp: new Date("2024-01-01T10:00:01"),
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should only have server messages (duplicates removed)
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "server-1");
  assert.equal(result[1].id, "server-2");
});

test("mergeMessages - should keep local messages that don't have server duplicates", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
    {
      id: "local-2",
      type: "ai",
      content: "This is a unique local message",
      timestamp: new Date("2024-01-01T10:00:05"),
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should have server message + unique local message
  assert.equal(result.length, 2);
  assert.ok(result.find((m) => m.id === "server-1"));
  assert.ok(result.find((m) => m.id === "local-2"));
  // Local duplicate should be removed
  assert.equal(
    result.find((m) => m.id === "local-1"),
    undefined,
  );
});

test("mergeMessages - should handle timestamp tolerance (within 5 seconds)", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:03"), // 3 seconds later
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should be considered duplicate (within 5 seconds)
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "server-1");
});

test("mergeMessages - should not consider messages duplicates if timestamps differ by more than 5 seconds", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:06"), // 6 seconds later
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should NOT be considered duplicate (more than 5 seconds)
  assert.equal(result.length, 2);
});

test("mergeMessages - should not consider messages duplicates if content differs", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "user",
      content: "Hello there", // Different content
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should NOT be considered duplicate (different content)
  assert.equal(result.length, 2);
});

test("mergeMessages - should not consider messages duplicates if type differs", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "ai", // Different type
      content: "Hello",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should NOT be considered duplicate (different type)
  assert.equal(result.length, 2);
});

test("mergeMessages - should sort messages by timestamp", () => {
  const serverMessages: Message[] = [
    {
      id: "server-2",
      type: "ai",
      content: "Response 2",
      timestamp: new Date("2024-01-01T10:00:02"),
    },
    {
      id: "server-1",
      type: "user",
      content: "Question 1",
      timestamp: new Date("2024-01-01T10:00:00"),
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "ai",
      content: "Response 1",
      timestamp: new Date("2024-01-01T10:00:01"),
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should be sorted by timestamp
  const time0 =
    result[0].timestamp instanceof Date
      ? result[0].timestamp.getTime()
      : new Date(result[0].timestamp).getTime();
  const time1 =
    result[1].timestamp instanceof Date
      ? result[1].timestamp.getTime()
      : new Date(result[1].timestamp).getTime();
  const time2 =
    result[2].timestamp instanceof Date
      ? result[2].timestamp.getTime()
      : new Date(result[2].timestamp).getTime();

  assert.equal(time0, new Date("2024-01-01T10:00:00").getTime());
  assert.equal(time1, new Date("2024-01-01T10:00:01").getTime());
  assert.equal(time2, new Date("2024-01-01T10:00:02").getTime());
});

test("mergeMessages - should handle string timestamps", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: "2024-01-01T10:00:00Z",
    },
  ];

  const localMessages: Message[] = [
    {
      id: "local-1",
      type: "user",
      content: "Hello",
      timestamp: "2024-01-01T10:00:00Z",
    },
  ];

  const result = mergeMessages(serverMessages, localMessages);

  // Should handle string timestamps correctly
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "server-1");
});

test("detectNewAIMessages - should detect new AI messages not in current messages", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date(),
    },
    {
      id: "server-2",
      type: "ai",
      content: "Hi there",
      timestamp: new Date(),
    },
    {
      id: "server-3",
      type: "ai",
      content: "Another response",
      timestamp: new Date(),
    },
  ];

  const currentMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date(),
    },
    {
      id: "server-2",
      type: "ai",
      content: "Hi there",
      timestamp: new Date(),
    },
  ];

  const result = detectNewAIMessages(serverMessages, currentMessages);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "server-3");
  assert.equal(result[0].type, "ai");
});

test("detectNewAIMessages - should return empty array if no new AI messages", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date(),
    },
  ];

  const currentMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "Hello",
      timestamp: new Date(),
    },
  ];

  const result = detectNewAIMessages(serverMessages, currentMessages);

  assert.equal(result.length, 0);
});

test("detectNewAIMessages - should not detect user messages as new", () => {
  const serverMessages: Message[] = [
    {
      id: "server-1",
      type: "user",
      content: "New question",
      timestamp: new Date(),
    },
  ];

  const currentMessages: Message[] = [];

  const result = detectNewAIMessages(serverMessages, currentMessages);

  // Should not detect user messages
  assert.equal(result.length, 0);
});
