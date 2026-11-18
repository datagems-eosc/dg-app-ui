import { afterEach, expect, it, vi } from "vitest";
import { downloadFilename, saveOriginalFile } from "./fileDownload";

it.each([
  ["attachment; filename=stored.hash.csv", "stored.hash.csv"],
  [
    "attachment; filename*=UTF-8''%C5%BC%C3%B3%C5%82w.hash.json; filename=fallback.json",
    "żółw.hash.json",
  ],
  ['attachment; filename="../stored.hash.pdf"', "stored.hash.pdf"],
  [
    "attachment; filename*=UTF-8''%broken; filename=stored.hash.csv",
    "stored.hash.csv",
  ],
  ["attachment", "fallback.hash.bin"],
  ['attachment; filename=".."', "download"],
])(
  "uses a browser-safe supplied filename without removing storage suffixes: %s",
  (header, expected) => {
    expect(
      downloadFilename(
        new Response(null, { headers: { "Content-Disposition": header } }),
        "fallback.hash.bin",
      ),
    ).toBe(expected);
  },
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("keeps the blob URL alive after activation, then releases it exactly once", () => {
  vi.useFakeTimers();
  const create = vi.fn(() => "blob:original");
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  saveOriginalFile(new Blob(["original"]), "original.csv");
  expect(click).toHaveBeenCalledTimes(1);
  expect(document.querySelector("a[download]")).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:original");
});
