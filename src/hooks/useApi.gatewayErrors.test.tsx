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

import { logApiError } from "@/lib/logger";
import { useApi } from "./useApi";

/**
 * UI #375: a failed Gateway request surfaces classified copy, never the
 * Gateway's own `error` text. Bodies as recorded from the Gateway (HTTP 424,
 * code 104) in the gateway-error-messages assessment.
 */
const API_BASE = "https://gateway.test/dg";
const RAW_GATEWAY_TEXT = "error communicating with underpinning service";
const CORRELATION_ID = "50c7a41b-757f-440d-a4e8-eef5be144cb2";

const upstreamFailure = (statusCode: number | null, payload: unknown = null) =>
  new Response(
    JSON.stringify({
      code: 104,
      error: RAW_GATEWAY_TEXT,
      message: {
        statusCode,
        source: "InDataExploration",
        correlationId: CORRELATION_ID,
        payload,
      },
    }),
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

  it("shows the service's message for an unanswerable Language question", async () => {
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
      result.current.getLinguisticFeatures({
        DatasetIds: ["d-1"],
        Query: "qwzx vbnm plok",
      }),
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

  it("passes a local abort through unchanged", async () => {
    stubFetch(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.searchInDataExplore({ question: "rain" }),
    ).rejects.toMatchObject({ name: "AbortError" });
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
        body: JSON.stringify({
          code: 104,
          error: RAW_GATEWAY_TEXT,
          message: {
            statusCode: 503,
            source: "DataManagement",
            correlationId: CORRELATION_ID,
          },
        }),
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

  it("logs the classification without the payload", async () => {
    stubFetch(async () => upstreamFailure(400, '{"echo":"qwzx vbnm plok"}'));
    const { result } = renderHook(() => useApi());

    await result.current
      .getLinguisticFeatures({ DatasetIds: ["d-1"], Query: "qwzx vbnm plok" })
      .catch(() => undefined);

    expect(logApiError).toHaveBeenCalledWith(
      "getLinguisticFeatures",
      expect.any(Error),
      expect.objectContaining({
        status: 424,
        code: 104,
        source: "InDataExploration",
        upstreamStatus: 400,
        correlationId: CORRELATION_ID,
      }),
    );
    expect(JSON.stringify(vi.mocked(logApiError).mock.calls)).not.toContain(
      "qwzx",
    );
  });
});
