import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  useSession,
  getSession,
}));

import { useApi } from "./useApi";

beforeEach(() => {
  getSession.mockReset();
  useSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "test-token", user: { id: "user" } },
  });
  window.__env = {
    ...window.__env,
    DATAGEMS_API_BASE_URL: "https://gateway.test",
  };
});

afterEach(() => vi.unstubAllGlobals());

it("exposes the authenticated session principal and updates it on account change", () => {
  const { result, rerender } = renderHook(() => useApi());
  expect(result.current.sessionPrincipalId).toBe("user");
  useSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "another-token", user: { id: "another-user" } },
  });
  rerender();
  expect(result.current.sessionPrincipalId).toBe("another-user");
});

it.each([
  ["loading", { accessToken: "test-token", user: { id: "user" } }],
  ["unauthenticated", null],
  ["authenticated", { user: { id: "user" } }],
  [
    "authenticated",
    { accessToken: "test-token", user: { id: "user" }, error: "RefreshError" },
  ],
  ["authenticated", { accessToken: "test-token", user: { id: "  " } }],
  ["authenticated", { accessToken: "test-token", user: { id: 42 } }],
  ["authenticated", { accessToken: "test-token", user: { email: "u@test" } }],
])(
  "returns no principal for an unavailable session (%s, %j)",
  (status, data) => {
    useSession.mockReturnValue({ status, data });
    const { result } = renderHook(() => useApi());
    expect(result.current.sessionPrincipalId).toBeNull();
  },
);

it("passes download cancellation to the authenticated Gateway request", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("original"));
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useApi());
  const controller = new AbortController();
  await result.current.downloadDatasetFile(
    "dataset",
    "file",
    controller.signal,
  );
  expect(fetch).toHaveBeenCalledWith(
    "https://gateway.test/gw/api/storage/download/dataset/dataset/file-object/file",
    expect.objectContaining({ signal: controller.signal }),
  );
});

it("does not replay an original download with another account's refreshed credentials", async () => {
  getSession.mockResolvedValue({
    accessToken: "another-token",
    user: { id: "another-user" },
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response("another account's bytes"));
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useApi());
  const outcome = await result.current
    .downloadDatasetFile("dataset", "file", new AbortController().signal)
    .catch((error) => error);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(outcome).toMatchObject({ status: 401 });
});

it.each([undefined, "", 42])(
  "does not replay when the refreshed principal is unreadable: %j",
  async (id) => {
    getSession.mockResolvedValue({
      accessToken: "refreshed-token",
      user: { id },
    });
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.downloadDatasetFile("dataset", "file"),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it("preserves refresh and retry for the same principal", async () => {
  getSession.mockResolvedValue({
    accessToken: "refreshed-token",
    user: { id: "user" },
  });
  const original = new Response("original");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(original);
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useApi());
  const controller = new AbortController();
  await expect(
    result.current.downloadDatasetFile("dataset", "file", controller.signal),
  ).resolves.toBe(original);
  expect(fetch).toHaveBeenCalledTimes(2);
  const options = fetch.mock.calls[1][1] as RequestInit;
  expect(new Headers(options.headers).get("Authorization")).toBe(
    "Bearer refreshed-token",
  );
  expect(options.signal).toBe(controller.signal);
});

it("stops an aborted download after session refresh, before retry or logout", async () => {
  let resolve!: (value: unknown) => void;
  getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useApi());
  const controller = new AbortController();
  const pending = result.current.downloadDatasetFile(
    "dataset",
    "file",
    controller.signal,
  );
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
  controller.abort();
  resolve(null);
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(1);
});
