import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./__testing__/layout";
import { FoldedNameList } from "./FoldedNameList";

afterEach(() => vi.restoreAllMocks());

/** The measuring copy is hidden from people and from these queries. */
const seen = { ignore: "[aria-hidden='true']" };

const countries = [
  "Greece",
  "Portugal",
  "Poland",
  "Germany",
  "France",
  "United States",
  "United Kingdom",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Finland",
  "Czechia",
];

describe("FoldedNameList", () => {
  it("renders nothing without names", () => {
    const { container } = render(
      <FoldedNameList items={[]} about="countries" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("joins names that fit with commas, with no toggle", () => {
    stubLayout({ width: 300 });
    render(<FoldedNameList items={["English", "Greek"]} about="languages" />);
    expect(screen.getByText("English, Greek", seen)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps whole names on two lines, then +N more, which expands and collapses", () => {
    // 300 px at 8 px a character: 37 characters a line, 75 in two lines.
    stubLayout({ width: 300 });
    render(<FoldedNameList items={countries} about="countries" />);
    const more = screen.getByRole("button", { name: /^\+\d+ more countries$/ });
    const hidden = Number(/\+(\d+)/.exec(more.textContent ?? "")?.[1]);
    const shown = countries.slice(0, countries.length - hidden);
    const text = more.parentElement?.textContent ?? "";
    expect(text).toBe(`${shown.join(", ")} +${hidden} more`);
    expect(text.length).toBeLessThanOrEqual(75);
    expect(text).not.toContain("…");

    fireEvent.click(more);
    expect(
      screen.getByText(countries.join(", "), { ...seen, exact: false }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Show less, countries" }),
    );
    expect(
      screen.getByRole("button", { name: `+${hidden} more countries` }),
    ).toBeInTheDocument();
  });

  it("shows one very long name whole, never cut", () => {
    stubLayout({ width: 100 });
    const name = "The United Kingdom of Great Britain and Northern Ireland";
    render(<FoldedNameList items={[name, "Spain"]} about="countries" />);
    expect(
      screen.getByText(name, { ...seen, exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+1 more countries" }),
    ).toBeInTheDocument();
  });
});
