import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  Classification,
  ClassificationOutcome,
} from "@/lib/intentRouting/types";
import { useHomeQuery } from "./useHomeQuery";

const deferred = () => {
  let resolve!: (value: ClassificationOutcome) => void;
  const promise = new Promise<ClassificationOutcome>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const ok = (
  intent: Classification["intent"],
  extra: Partial<Classification> = {},
): ClassificationOutcome => ({
  ok: true,
  classification: {
    intent,
    degraded: false,
    retrievalQuery: null,
    confidence: 0.9,
    model: null,
    promptVersion: null,
    ...extra,
  },
});

const setup = (classify = vi.fn()) => {
  const onNavigate = vi.fn();
  const hook = renderHook(() => useHomeQuery({ classify, onNavigate }));
  return { ...hook, classify, onNavigate };
};

const type = (
  result: { current: ReturnType<typeof useHomeQuery> },
  text: string,
) => act(() => result.current.setText(text));

describe("useHomeQuery", () => {
  it("does nothing for empty or whitespace input", async () => {
    const { result, classify } = setup();
    await type(result, "   ");
    await act(() => result.current.submit());
    expect(classify).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("idle");
  });

  it("sends one request per submission and ignores repeat submits while pending", async () => {
    const pending = deferred();
    const { result, classify } = setup(vi.fn(() => pending.promise));
    await type(result, "datasets about education");

    act(() => {
      void result.current.submit();
      void result.current.submit();
    });
    expect(result.current.state.status).toBe("classifying");
    expect(classify).toHaveBeenCalledTimes(1);
    expect(classify.mock.calls[0][0]).toBe("datasets about education");

    await act(async () => pending.resolve(ok("ambiguous")));
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("hands a dataset search to Browse with the retrieval query", async () => {
    const { result, onNavigate } = setup(
      vi
        .fn()
        .mockResolvedValue(
          ok("dataset_search", { retrievalQuery: "education Greece" }),
        ),
    );
    await type(result, "  datasets about education in Greece ");
    await act(() => result.current.submit());

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith({
      originalQuery: "datasets about education in Greece",
      retrievalQuery: "education Greece",
      intent: "dataset_search",
      chosenBy: "classifier",
    });
    expect(result.current.state.status).toBe("navigating");
  });

  it("hands a question to chat", async () => {
    const { result, onNavigate } = setup(
      vi.fn().mockResolvedValue(ok("question")),
    );
    await type(result, "What is the mean temperature in Athens?");
    await act(() => result.current.submit());
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "question", retrievalQuery: null }),
    );
  });

  it("asks the user on an ambiguous result and continues without reclassifying", async () => {
    const { result, classify, onNavigate } = setup(
      vi
        .fn()
        .mockResolvedValue(
          ok("ambiguous", { retrievalQuery: "surface temperature Greece" }),
        ),
    );
    await type(result, "surface temperature in Greece");
    await act(() => result.current.submit());

    expect(result.current.state).toMatchObject({
      status: "clarify",
      degraded: false,
    });
    expect(onNavigate).not.toHaveBeenCalled();

    act(() => result.current.choose("question"));
    expect(classify).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith({
      originalQuery: "surface temperature in Greece",
      retrievalQuery: "surface temperature Greece",
      intent: "question",
      chosenBy: "user",
    });
  });

  it("never navigates on a degraded result", async () => {
    const { result, onNavigate } = setup(
      vi.fn().mockResolvedValue(ok("question", { degraded: true })),
    );
    await type(result, "rainfall in Crete");
    await act(() => result.current.submit());
    expect(result.current.state).toMatchObject({
      status: "clarify",
      degraded: true,
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("explains an out-of-scope request and still allows finding datasets", async () => {
    const { result, onNavigate } = setup(
      vi.fn().mockResolvedValue(ok("out_of_scope")),
    );
    await type(result, "Book me a flight to Athens");
    await act(() => result.current.submit());
    expect(result.current.state.status).toBe("outOfScope");
    expect(onNavigate).not.toHaveBeenCalled();

    act(() => result.current.choose("dataset_search"));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "dataset_search",
        originalQuery: "Book me a flight to Athens",
        chosenBy: "user",
      }),
    );
  });

  it.each(["network", "http", "auth", "unavailable", "invalid"] as const)(
    "shows a %s failure with choices and retries only on request",
    async (kind) => {
      const classify = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, kind })
        .mockResolvedValueOnce(ok("question"));
      const { result, onNavigate } = setup(classify);
      await type(result, "rainfall trends in Crete");
      await act(() => result.current.submit());

      expect(result.current.state).toMatchObject({ status: "failed", kind });
      expect(onNavigate).not.toHaveBeenCalled();
      expect(classify).toHaveBeenCalledTimes(1);

      await act(() => result.current.retry());
      expect(classify).toHaveBeenCalledTimes(2);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores a late result after the text was edited", async () => {
    const pending = deferred();
    const { result, onNavigate } = setup(vi.fn(() => pending.promise));
    await type(result, "datasets about education");
    act(() => {
      void result.current.submit();
    });
    await type(result, "datasets about nursing");
    expect(result.current.state.status).toBe("idle");

    await act(async () => pending.resolve(ok("dataset_search")));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.text).toBe("datasets about nursing");
  });

  it("aborts and ignores the result after cancel", async () => {
    const pending = deferred();
    const classify = vi.fn(
      (_q: string, _o: { signal: AbortSignal }) => pending.promise,
    );
    const { result, onNavigate } = setup(classify);
    await type(result, "datasets about education");
    act(() => {
      void result.current.submit();
    });
    act(() => result.current.cancel());

    expect(classify.mock.calls[0][1].signal.aborted).toBe(true);
    expect(result.current.state).toMatchObject({
      status: "idle",
      text: "datasets about education",
    });
    await act(async () => pending.resolve(ok("question")));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("aborts on unmount and never navigates afterwards", async () => {
    const pending = deferred();
    const classify = vi.fn(
      (_q: string, _o: { signal: AbortSignal }) => pending.promise,
    );
    const { result, unmount, onNavigate } = setup(classify);
    await type(result, "datasets about education");
    act(() => {
      void result.current.submit();
    });
    unmount();
    expect(classify.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => pending.resolve(ok("dataset_search")));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("editing while a choice is shown removes it and the next submit classifies again", async () => {
    const classify = vi.fn().mockResolvedValue(ok("ambiguous"));
    const { result } = setup(classify);
    await type(result, "surface temperature in Greece");
    await act(() => result.current.submit());
    expect(result.current.state.status).toBe("clarify");

    await type(result, "surface temperature datasets");
    expect(result.current.state.status).toBe("idle");
    await act(() => result.current.submit());
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("allows a new submission after cancelling", async () => {
    const first = deferred();
    const classify = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(ok("dataset_search"));
    const { result, onNavigate } = setup(classify);
    await type(result, "datasets about education");
    act(() => {
      void result.current.submit();
    });
    act(() => result.current.cancel());
    await act(() => result.current.submit());
    expect(classify).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
