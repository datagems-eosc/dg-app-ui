import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./__testing__/layout";
import { FoldedChipList } from "./FoldedChipList";

afterEach(() => vi.restoreAllMocks());

const chipTexts = (list: HTMLElement) =>
  within(list)
    .queryAllByRole("listitem")
    .map((item) => item.textContent)
    .filter((text) => !/more$|^Show less$/.test(text ?? ""));

describe("FoldedChipList", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(
      <FoldedChipList items={[]} label="Keywords" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every chip when they fit in two lines", () => {
    stubLayout({ width: 300 });
    render(<FoldedChipList items={["algebra", "climate"]} label="Keywords" />);
    const list = screen.getByRole("list", { name: "Keywords" });
    expect(chipTexts(list)).toEqual(["algebra", "climate"]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("folds many chips to two lines with +N more, and expands and collapses", () => {
    // 10 characters = 96 px per chip: three chips a line in 300 px.
    stubLayout({ width: 300 });
    const items = Array.from(
      { length: 12 },
      (_, i) => `keyword-${String(i).padStart(2, "0")}`,
    );
    render(<FoldedChipList items={items} label="Keywords" />);
    const list = screen.getByRole("list", { name: "Keywords" });
    // Line two keeps two chips and "+N more".
    expect(chipTexts(list)).toEqual(items.slice(0, 5));
    const more = screen.getByRole("button", { name: "+7 more keywords" });
    expect(more).toHaveTextContent("+7 more");
    expect(more).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(more);
    expect(chipTexts(list)).toEqual(items);
    const less = screen.getByRole("button", { name: "Show less, keywords" });
    expect(less).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(less);
    expect(chipTexts(list)).toEqual(items.slice(0, 5));
  });

  it("keeps a single very long chip whole as one truncated line with its full text", () => {
    stubLayout({ width: 120 });
    const long =
      "a very specific interdisciplinary keyword phrase that never ends";
    render(<FoldedChipList items={[long]} label="Keywords" />);
    const list = screen.getByRole("list", { name: "Keywords" });
    expect(chipTexts(list)).toEqual([long]);
    expect(
      screen.queryByRole("button", { name: /more/ }),
    ).not.toBeInTheDocument();
  });

  it("drops blank and repeated items", () => {
    stubLayout();
    render(
      <FoldedChipList
        items={["EU", " ", "eu", "Greece"]}
        label="Collections"
      />,
    );
    expect(
      chipTexts(screen.getByRole("list", { name: "Collections" })),
    ).toEqual(["EU", "Greece"]);
  });
});
