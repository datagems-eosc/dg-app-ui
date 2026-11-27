import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./__testing__/layout";
import { ShortenedLink } from "./ShortenedLink";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const visible = (link: HTMLElement) =>
  link.querySelector("[data-shown]")?.textContent;

describe("ShortenedLink", () => {
  it("opens a short address in a new tab, as people read it", () => {
    stubLayout({ width: 400 });
    render(
      <ShortenedLink href="https://www.github.com/google-deepmind/AQuA/" />,
    );
    const link = screen.getByRole("link", {
      name: "https://www.github.com/google-deepmind/AQuA/ (opens in a new tab)",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.github.com/google-deepmind/AQuA/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(visible(link)).toBe("github.com/google-deepmind/AQuA");
  });

  it("shortens a long address in the middle and keeps the whole one as its name and tooltip", async () => {
    vi.useFakeTimers();
    // 200 px at 8 px a character, less the icon: about 22 characters.
    stubLayout({ width: 200 });
    const href =
      "https://archive.ics.uci.edu/dataset/544/estimation+of+obesity+levels+based+on+eating+habits+and+physical+condition";
    render(<ShortenedLink href={href} />);
    const link = screen.getByRole("link", {
      name: `${href} (opens in a new tab)`,
    });
    const shown = visible(link) ?? "";
    expect(shown).toMatch(/^archive\.[^…]*…[^…]*condition$/);
    expect(shown.length * 8).toBeLessThanOrEqual(200);

    fireEvent.mouseEnter(link.parentElement as HTMLElement);
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText(href)).toBeInTheDocument();
    expect(screen.getByText(href).closest("a")).toBeNull();
  });

  it("keeps an unbroken address without separators on one line", () => {
    stubLayout({ width: 160 });
    const href = `https://example.org/${"x".repeat(200)}`;
    render(<ShortenedLink href={href} />);
    const shown = visible(screen.getByRole("link")) ?? "";
    expect(shown).toContain("…");
    expect(shown.length * 8).toBeLessThanOrEqual(160);
  });
});
