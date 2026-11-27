import { vi } from "vitest";

/**
 * A deterministic stand-in for browser layout in jsdom: every character is
 * `char` px wide, chips add `chipPadding`, a line is `line` px tall and every
 * container is `width` px wide. Text wraps by width alone.
 */
export function stubLayout({
  width = 300,
  char = 8,
  chipPadding = 16,
  line = 24,
}: {
  width?: number;
  char?: number;
  chipPadding?: number;
  line?: number;
} = {}) {
  // Text drawn by CSS from `data-measure-text` counts as text.
  const textWidth = (node: Element) => {
    const drawn = [node, ...node.querySelectorAll("[data-measure-text]")]
      .map((el) => el.getAttribute("data-measure-text") ?? "")
      .join("");
    return ((node.textContent ?? "") + drawn).length * char;
  };
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return textWidth(this);
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return Math.max(1, Math.ceil(textWidth(this) / width)) * line;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const w = textWidth(this) + chipPadding;
      return {
        width: w,
        height: line,
        top: 0,
        left: 0,
        right: w,
        bottom: line,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
}
