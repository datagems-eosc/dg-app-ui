import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();
  return { ...actual, logApiError: vi.fn(), logWarn: vi.fn() };
});

import {
  CORRELATION_ID,
  upstreamFailureBody,
} from "@/lib/gatewayError.fixtures";
import { apiLogger, logApiError } from "@/lib/logger";
import { useApi } from "./useApi";

// Bodies as recorded from the Gateway (HTTP 424, code 104).
const API_BASE = "https://gateway.test/dg";

const upstreamFailure = (statusCode: number | null, payload: unknown = null) =>
  new Response(
    JSON.stringify(
      upstreamFailureBody(statusCode, "InDataExploration", payload),
    ),
    { status: 424 },
  );

const stubFetch = (impl: () => Promise<Response>) =>
  vi.stubGlobal("fetch", vi.fn(impl));

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "token-1", user: { id: "u-1" } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useApi Gateway error messages", () => {
  it("shows the rephrase copy for an unanswerable in-data question", async () => {
    stubFetch(async () => upstreamFailure(422));
    const { result } = renderHook(() => useApi());

    const failure = result.current.searchInDataExplore({ question: "qwzx" });

    await expect(failure).rejects.toThrow(
      "This question can't be answered from the selected data. Try rephrasing it. Reference: 50c7a41b",
    );
  });

  it("keeps the service's message for an unanswerable Chat question", async () => {
    const payload = JSON.stringify({
      code: 102,
      error: "validation error",
      message: [
        {
          Key: "question",
          Value: ["The question cannot be answered from this dataset."],
        },
      ],
    });
    stubFetch(async () => upstreamFailure(400, payload));
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.searchInDataExplore({ question: "qwzx vbnm plok" }),
    ).rejects.toThrow(
      "The question cannot be answered from this dataset. Reference: 50c7a41b",
    );
  });

  it("shows the unavailable copy for a failing service when querying datasets", async () => {
    stubFetch(async () => upstreamFailure(500));
    const { result } = renderHook(() => useApi());

    const error = await result.current
      .queryDatasets({})
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "The service is temporarily unavailable. Please try again. Reference: 50c7a41b",
    );
  });

  it("shows the generic copy for a rejected collection request", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ code: 102, error: "validation error", message: [] }),
          { status: 400 },
        ),
    );
    const { result } = renderHook(() => useApi());

    await expect(result.current.createUserCollection("Rain")).rejects.toThrow(
      /^Something went wrong\. Please try again\.$/,
    );
  });

  it("shows the unavailable copy when no response arrives", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.searchInDataExplore({ question: "rain" }),
    ).rejects.toThrow(
      /^The service is temporarily unavailable\. Please try again\.$/,
    );
  });

  it("shows the unavailable copy on a timeout and logs which request failed", async () => {
    stubFetch(async () => {
      throw new DOMException("signal timed out", "TimeoutError");
    });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.searchInDataExplore({ question: "rain" }),
    ).rejects.toThrow(
      /^The service is temporarily unavailable\. Please try again\.$/,
    );
    expect(logApiError).toHaveBeenCalledWith(
      "request",
      expect.anything(),
      expect.objectContaining({
        kind: "unavailable",
        cause: "TimeoutError",
        endpoint: expect.stringContaining("in-data-explore"),
      }),
    );
  });

  it("passes a local abort through unchanged", async () => {
    stubFetch(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.searchInDataExplore({ question: "rain" }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rethrows a TypeError that did not come from fetch itself", async () => {
    // A response-less resolve makes the transport fail on `response.status`:
    // a code error, not a missing response.
    stubFetch(async () => undefined as unknown as Response);
    const { result } = renderHook(() => useApi());

    const failure = result.current.searchInDataExplore({ question: "rain" });

    await expect(failure).rejects.toBeInstanceOf(TypeError);
    await expect(failure).rejects.not.toThrow(/temporarily unavailable/);
  });

  describe("dataset upload", () => {
    /** Minimal stand-in for the uploader's XMLHttpRequest. */
    const stubXhr = (outcome: { status: number; body: string } | "network") => {
      class FakeXhr {
        status = 0;
        responseText = "";
        upload = { addEventListener: () => undefined };
        private listeners: Record<string, () => void> = {};
        addEventListener(type: string, listener: () => void) {
          this.listeners[type] = listener;
        }
        open() {}
        setRequestHeader() {}
        send() {
          if (outcome === "network") {
            this.listeners.error?.();
            return;
          }
          this.status = outcome.status;
          this.responseText = outcome.body;
          this.listeners.load?.();
        }
      }
      vi.stubGlobal("XMLHttpRequest", FakeXhr);
    };
    const file = () => new File(["a,b"], "readings.csv");

    it("shows classified copy for a failed upload", async () => {
      stubXhr({
        status: 424,
        body: JSON.stringify(upstreamFailureBody(503, "DataManagement")),
      });
      const { result } = renderHook(() => useApi());

      await expect(result.current.uploadDatasetFiles([file()])).rejects.toThrow(
        "The service is temporarily unavailable. Please try again. Reference: 50c7a41b",
      );
    });

    it("shows the unavailable copy when the upload gets no response", async () => {
      stubXhr("network");
      const { result } = renderHook(() => useApi());

      await expect(result.current.uploadDatasetFiles([file()])).rejects.toThrow(
        /^The service is temporarily unavailable\. Please try again\.$/,
      );
    });
  });

  it("logs the classification without the shown text or the payload", async () => {
    // The service's message is shown to the user, and it can quote the question.
    stubFetch(async () =>
      upstreamFailure(
        400,
        '{"code":102,"message":[{"Key":"question","Value":["Question qwzx vbnm plok cannot be answered."]}]}',
      ),
    );
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getLinguisticFeatures({
        DatasetIds: ["d-1"],
        Query: "qwzx vbnm plok",
      }),
    ).rejects.toThrow(/qwzx vbnm plok/);

    expect(logApiError).toHaveBeenCalledWith(
      "getLinguisticFeatures",
      expect.anything(),
      expect.objectContaining({
        status: 424,
        code: 104,
        source: "InDataExploration",
        upstreamStatus: 400,
        correlationId: CORRELATION_ID,
      }),
    );
    const logged = JSON.stringify(vi.mocked(logApiError).mock.calls, (_, v) =>
      v instanceof Error ? v.message : v,
    );
    expect(logged).not.toContain("qwzx");
  });
});

describe("useApi request logs", () => {
  const TYPED = "qwzx vbnm plok";
  type Api = ReturnType<typeof useApi>;

  it.each<[string, string, (api: Api) => Promise<unknown>]>([
    [
      "Language question",
      "/pilot/language/linguistic-features",
      (api) => api.getLinguisticFeatures({ DatasetIds: ["d-1"], Query: TYPED }),
    ],
    [
      "next-query suggestions",
      "/search/recommend",
      (api) => api.getRecommendNextQueries(TYPED),
    ],
    [
      "new collection name",
      "/collection/persist",
      (api) => api.createUserCollection(TYPED),
    ],
    [
      "dataset search text",
      "/dataset/query",
      (api) => api.queryDatasets({ like: TYPED, project: { fields: ["id"] } }),
    ],
  ])(
    "logs the %s request without the typed text",
    async (_, endpoint, call) => {
      stubFetch(async () => new Response("{}", { status: 200 }));
      const info = vi.spyOn(apiLogger, "info");
      const { result } = renderHook(() => useApi());

      await call(result.current).catch(() => undefined);

      const requestLogs = info.mock.calls.filter(
        ([fields]) => (fields as { type?: string }).type === "request",
      );
      expect(requestLogs).toContainEqual([
        expect.objectContaining({ endpoint }),
        expect.any(String),
      ]);
      expect(JSON.stringify(info.mock.calls)).not.toContain("qwzx");
    },
  );

  it.each<[string, Record<string, unknown>, (api: Api) => Promise<unknown>]>([
    [
      "Language question",
      { datasetIds: ["d-1", "d-2"] },
      (api) =>
        api.getLinguisticFeatures({ DatasetIds: ["d-1", "d-2"], Query: TYPED }),
    ],
    [
      "dataset onboarding",
      { locationCount: 2 },
      (api) =>
        api.onboardDataset({
          code: TYPED,
          name: TYPED,
          description: TYPED,
          license: "CC-BY-4.0",
          mimeType: "text/csv",
          size: 1,
          headline: TYPED,
          keywords: [TYPED],
          fieldOfScience: [],
          datePublished: "2026-11-27",
          dataLocations: [
            { kind: 0, location: "staging/a.csv" },
            { kind: 0, location: "staging/b.csv" },
          ],
        }),
    ],
    [
      "user lookup",
      { idCount: 2 },
      (api) => api.queryUsers({ ids: ["u-1", "u-2"], like: TYPED }),
    ],
    [
      "user group lookup",
      { idCount: 1 },
      (api) => api.queryUserGroups({ ids: ["g-1"], like: TYPED }),
    ],
  ])(
    "logs the %s request with its ids or counts and without the typed text",
    async (_, expected, call) => {
      stubFetch(async () => new Response("{}", { status: 200 }));
      const info = vi.spyOn(apiLogger, "info");
      const { result } = renderHook(() => useApi());

      await call(result.current).catch(() => undefined);

      const requestLogs = info.mock.calls.filter(
        ([fields]) => (fields as { type?: string }).type === "request",
      );
      expect(requestLogs).toContainEqual([
        expect.objectContaining(expected),
        expect.any(String),
      ]);
      expect(JSON.stringify(info.mock.calls)).not.toContain("qwzx");
      expect(JSON.stringify(info.mock.calls)).not.toContain("u-1");
    },
  );

  it("logs the Language answer without text that repeats the question", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            result: {
              rag_output: { results: [{ text: `About ${TYPED}` }] },
              features: { term_frequency: [{ term: TYPED, count: 1 }] },
            },
            conversationId: "c-1",
          }),
          { status: 200 },
        ),
    );
    const info = vi.spyOn(apiLogger, "info");
    const { result } = renderHook(() => useApi());

    await result.current.getLinguisticFeatures({
      DatasetIds: ["d-1"],
      Query: TYPED,
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "getLinguisticFeatures",
        type: "response",
      }),
      expect.any(String),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("qwzx");
  });
});
