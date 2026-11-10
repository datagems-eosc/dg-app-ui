import { beforeEach, describe, expect, it } from "vitest";
import { createHandoffStore, HANDOFF_TTL_MS } from "./handoffStore";
import type { IntentHandoff } from "./types";

const handoff: IntentHandoff = {
  originalQuery: "datasets about education",
  retrievalQuery: "education",
  intent: "dataset_search",
  chosenBy: "classifier",
};

describe("handoff store", () => {
  let now = 0;
  let store: ReturnType<typeof createHandoffStore>;

  beforeEach(() => {
    now = 1_000;
    let n = 0;
    store = createHandoffStore({ now: () => now, randomId: () => `id-${++n}` });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("returns an opaque id and lets the destination peek at the handoff", () => {
    const id = store.create(handoff);
    expect(id).toBe("id-1");
    expect(store.peek(id)).toEqual(handoff);
  });

  it("peek is pure: repeated peeks do not consume", () => {
    const id = store.create(handoff);
    store.peek(id);
    expect(store.peek(id)).toEqual(handoff);
  });

  it("consume succeeds exactly once", () => {
    const id = store.create(handoff);
    expect(store.consume(id)).toBe(true);
    expect(store.consume(id)).toBe(false);
    expect(store.peek(id)).toBeNull();
  });

  it("returns nothing for an unknown id (e.g. after a reload)", () => {
    expect(store.peek("unknown")).toBeNull();
    expect(store.consume("unknown")).toBe(false);
  });

  it("expires a pending handoff after the TTL", () => {
    const id = store.create(handoff);
    now += HANDOFF_TTL_MS + 1;
    expect(store.peek(id)).toBeNull();
    expect(store.consume(id)).toBe(false);
  });

  it("keeps separate submissions independent", () => {
    const first = store.create(handoff);
    const second = store.create({ ...handoff, intent: "question" });
    expect(store.consume(first)).toBe(true);
    expect(store.peek(second)?.intent).toBe("question");
  });

  it("never writes query text to browser storage", () => {
    store.consume(store.create(handoff));
    const stored = JSON.stringify({
      ...window.localStorage,
      ...window.sessionStorage,
    });
    expect(stored).not.toContain("education");
  });
});
