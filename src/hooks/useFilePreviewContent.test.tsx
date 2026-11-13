import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useFilePreviewContent } from "./useFilePreviewContent";

const entry = {
  id: "file",
  name: "file.json",
  data: {
    type: "json" as const,
    filename: "file.json",
    fileSize: "1 KB",
    description: "",
    keywords: [],
    content: "",
  },
};
it.each([403, 500])(
  "shows an explicit byte-preview failure for %s",
  async (status) => {
    const download = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("private"), { status }));
    const { result } = renderHook(() =>
      useFilePreviewContent("dataset", entry, download),
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({
      message:
        status === 403
          ? "Previewing this file needs download access."
          : "We couldn't load the preview.",
    });
  },
);
it("ignores delayed content after dataset or file changes", async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  const download = vi
    .fn()
    .mockReturnValueOnce(pending)
    .mockResolvedValue(new Response("new content"));
  const { result, rerender } = renderHook(
    ({ id }) => useFilePreviewContent(id, entry, download),
    { initialProps: { id: "old" } },
  );
  rerender({ id: "new" });
  await waitFor(() =>
    expect(result.current).toMatchObject({
      status: "ready",
      data: { content: "new content" },
    }),
  );
  await act(async () => {
    resolve(new Response("old content"));
  });
  expect(result.current).toMatchObject({
    status: "ready",
    data: { content: "new content" },
  });
});
it("retries failed bytes and keeps JSON bounded", async () => {
  const download = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(
      new Response(Array.from({ length: 200 }, (_, i) => String(i)).join("\n")),
    );
  const { result } = renderHook(() =>
    useFilePreviewContent("dataset", entry, download),
  );
  await waitFor(() => expect(result.current.status).toBe("error"));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("ready"));
  if (result.current.status === "ready" && result.current.data.type === "json")
    expect(result.current.data.content.split("\n")).toHaveLength(150);
});
it("releases PDF blob URLs when selection changes", async () => {
  const create = vi.fn(() => "blob:preview");
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  try {
    const pdf = {
      id: "pdf",
      name: "file.pdf",
      data: {
        type: "pdf" as const,
        filename: "file.pdf",
        fileSize: "1 KB",
        description: "",
        keywords: [],
        fileUrl: "",
        totalPages: 0,
      },
    };
    const download = vi
      .fn()
      .mockImplementation(async () => new Response("content"));
    const { result, rerender } = renderHook(
      ({ showPdf }) =>
        useFilePreviewContent("dataset", showPdf ? pdf : entry, download),
      { initialProps: { showPdf: true } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(create).toHaveBeenCalledTimes(1);
    rerender({ showPdf: false });
    expect(revoke).toHaveBeenCalledWith("blob:preview");
  } finally {
    vi.unstubAllGlobals();
  }
});
