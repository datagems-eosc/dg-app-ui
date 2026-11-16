import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCollectionPicker } from "./useCollectionPicker";

const fixture = vi.hoisted(() => ({
  query: vi.fn(),
  principal: "alice",
  hasToken: true,
}));
vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: fixture.hasToken,
    queryUserCollections: fixture.query,
    datasetPermissions: {
      scope: {
        principalId: fixture.principal,
        gatewayOrigin: "https://gateway.test",
      },
    },
  }),
}));
beforeEach(() => {
  fixture.principal = "alice";
  fixture.hasToken = true;
  fixture.query.mockReset().mockResolvedValue({ items: [], count: 0 });
});
it("loads every collection page only while enabled", async () => {
  fixture.query
    .mockResolvedValueOnce({
      items: Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
        name: `Collection ${index}`,
      })),
      count: 101,
    })
    .mockResolvedValueOnce({
      items: [{ id: "last", name: "Last" }],
      count: 101,
    });
  const { result, rerender } = renderHook(
    ({ enabled }) => useCollectionPicker({ enabled, scopeKey: "dataset-a" }),
    { initialProps: { enabled: false } },
  );
  expect(fixture.query).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.items).toHaveLength(101);
  expect(result.current.items[100].id).toBe("last");
  expect(
    fixture.query.mock.calls.map(([payload]) => payload.page.Offset),
  ).toEqual([0, 100]);
  expect(fixture.query).toHaveBeenCalledTimes(2);
  expect(fixture.query.mock.calls[0][0].project.fields).toEqual(["id", "name"]);
  expect(fixture.query.mock.calls[0][0].Order.Items).toEqual(["+name", "+id"]);
});
it.each([
  {},
  { items: null, count: 0 },
  { items: {}, count: 0 },
  ...[undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, "0"].map(
    (count) => ({ items: [], count }),
  ),
])("rejects malformed Gateway responses: %j", async (response) => {
  fixture.query.mockResolvedValueOnce(response);
  const { result } = renderHook(() =>
    useCollectionPicker({ enabled: true, scopeKey: "one" }),
  );
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.items).toEqual([]);
});
it.each(["offline", "malformed", "repeat", "empty"])(
  "never exposes partial results after a later %s page",
  async (failure) => {
    fixture.query.mockResolvedValueOnce({
      items: [{ id: "first", name: "First" }],
      count: 2,
    });
    if (failure === "offline")
      fixture.query.mockRejectedValueOnce(new Error("offline"));
    else
      fixture.query.mockResolvedValueOnce(
        failure === "malformed"
          ? {}
          : failure === "repeat"
            ? { items: [{ id: "first", name: "First" }], count: 2 }
            : { items: [], count: 2 },
      );
    const { result } = renderHook(() =>
      useCollectionPicker({ enabled: true, scopeKey: "one" }),
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.items).toEqual([]);
    expect(fixture.query).toHaveBeenCalledTimes(2);
  },
);
it("accepts a valid empty list", async () => {
  const { result } = renderHook(() =>
    useCollectionPicker({ enabled: true, scopeKey: "one" }),
  );
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.items).toEqual([]);
});
it("uses current credentials on retry without reloading for callback identity", async () => {
  const { result, rerender } = renderHook(() =>
    useCollectionPicker({ enabled: true, scopeKey: "one" }),
  );
  await waitFor(() => expect(result.current.status).toBe("ready"));
  const next = vi
    .fn()
    .mockResolvedValue({ items: [{ id: "new", name: "New" }], count: 1 });
  fixture.query = next;
  rerender();
  expect(next).not.toHaveBeenCalled();
  result.current.retry();
  await waitFor(() => expect(result.current.items[0]?.id).toBe("new"));
});
it.each(["close", "dataset", "account"])(
  "ignores stale completion after %s changes",
  async (change) => {
    let resolve!: (value: unknown) => void;
    fixture.query.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result, rerender } = renderHook(
      ({ enabled, scopeKey }) => useCollectionPicker({ enabled, scopeKey }),
      { initialProps: { enabled: true, scopeKey: "one" } },
    );
    if (change === "account") fixture.principal = "bob";
    rerender({
      enabled: change !== "close",
      scopeKey: change === "dataset" ? "two" : "one",
    });
    resolve({ items: [{ id: "old", name: "Old" }], count: 1 });
    await waitFor(() =>
      expect(result.current.status).toBe(change === "close" ? "idle" : "ready"),
    );
    expect(result.current.items).toEqual([]);
  },
);

it("does not load picker data without authentication", async () => {
  fixture.hasToken = false;
  const { result, rerender } = renderHook(() =>
    useCollectionPicker({ enabled: true, scopeKey: "dataset" }),
  );
  expect(result.current.status).toBe("idle");
  expect(fixture.query).not.toHaveBeenCalled();
  fixture.hasToken = true;
  rerender();
  await waitFor(() => expect(result.current.status).toBe("ready"));
});
