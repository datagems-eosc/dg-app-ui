import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useOriginalFileDownload } from "./useOriginalFileDownload";

const target = {
  datasetId: "dataset",
  fileId: "file",
  filename: "stored.hash.csv",
  principalId: "user",
  allowed: true,
};
const create = vi.fn((_blob: Blob) => "blob:original");
const revoke = vi.fn();
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  create.mockClear();
  revoke.mockClear();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
});
afterEach(async () => {
  await waitFor(
    () => expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length),
    { timeout: 2000 },
  );
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["pdf", "csv", "json", "bin"])(
  "saves full %s original bytes with the supplied stored filename",
  async (extension) => {
    const response = new Response("complete original, not preview", {
      headers: {
        "Content-Disposition": `attachment; filename="gateway.hash.${extension}"`,
      },
    });
    const download = vi.fn().mockResolvedValue(response);
    const { result } = renderHook(() =>
      useOriginalFileDownload(target, download),
    );
    await act(async () => result.current.start());
    expect(download).toHaveBeenCalledWith(
      "dataset",
      "file",
      expect.any(AbortSignal),
    );
    const blob = create.mock.calls[0][0];
    // Node's Response and jsdom's FileReader can use different Blob implementations.
    const saved =
      typeof blob.text === "function"
        ? await blob.text()
        : await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(blob);
          });
    expect(saved).toBe("complete original, not preview");
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
      `gateway.hash.${extension}`,
    );

    expect(result.current.status).toBe("idle");
  },
);

it.each([
  { allowed: false },
  { fileId: undefined },
  { fileId: "" },
  { principalId: null },
  { datasetId: "" },
])(
  "sends nothing for unavailable permission or identity %j",
  async (override) => {
    const download = vi.fn().mockResolvedValue(new Response("secret"));
    const { result } = renderHook(() =>
      useOriginalFileDownload({ ...target, ...override }, download),
    );
    await act(async () => result.current.start());
    expect(download).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  },
);

it.each([403, 500, "network"])(
  "reports %s failure and retries without saving an error",
  async (failure) => {
    const download = vi.fn();
    if (typeof failure === "number")
      download.mockResolvedValueOnce(
        new Response("private error", { status: failure }),
      );
    else download.mockRejectedValueOnce(new TypeError("offline"));
    download.mockResolvedValue(new Response("original"));
    const { result } = renderHook(() =>
      useOriginalFileDownload(target, download),
    );
    await act(async () => result.current.start());
    expect(result.current.status).toBe("error");
    expect(click).not.toHaveBeenCalled();
    await act(async () => result.current.start());
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  },
);

it("prevents duplicate requests while pending and permits another download after success", async () => {
  let resolve!: (response: Response) => void;
  const download = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValue(new Response("again"));
  const { result } = renderHook(() =>
    useOriginalFileDownload(target, download),
  );
  let first!: Promise<void>;
  act(() => {
    first = result.current.start();
    void result.current.start();
  });
  expect(result.current.status).toBe("pending");
  expect(download).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(new Response("first"));
    await first;
  });
  await act(async () => result.current.start());
  expect(click).toHaveBeenCalledTimes(2);
});

it.each([
  { datasetId: "another" },
  { fileId: "another" },
  { principalId: "another" },
  { allowed: false },
  { principalId: null },
])(
  "aborts and discards a late response after context changes %j",
  async (override) => {
    let resolve!: (response: Response) => void;
    const download = vi.fn().mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const { result, rerender } = renderHook(
      ({ context }) => useOriginalFileDownload(context, download),
      {
        initialProps: {
          context: target as Omit<typeof target, "principalId"> & {
            principalId: string | null;
          },
        },
      },
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.start();
    });
    const signal = download.mock.calls[0][2] as AbortSignal;
    rerender({ context: { ...target, ...override } });
    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe("idle");
    await act(async () => {
      resolve(new Response("old secret"));
      await pending;
    });
    expect(create).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  },
);

it("discards a pending blob after unmount", async () => {
  let resolve!: (blob: Blob) => void;
  const response = new Response("original");
  vi.spyOn(response, "blob").mockReturnValue(
    new Promise<Blob>((done) => {
      resolve = done;
    }),
  );
  const download = vi.fn().mockResolvedValue(response);
  const { result, unmount } = renderHook(() =>
    useOriginalFileDownload(target, download),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.start();
  });
  await waitFor(() => expect(response.blob).toHaveBeenCalled());
  unmount();
  expect((download.mock.calls[0][2] as AbortSignal).aborted).toBe(true);
  await act(async () => {
    resolve(new Blob(["old"]));
    await pending;
  });
  expect(create).not.toHaveBeenCalled();
});
