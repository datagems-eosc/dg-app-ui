import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DatasetSourceUrlSection from "./DatasetSourceUrlSection";

describe("DatasetSourceUrlSection", () => {
  it("omits the entire section when the source URL is missing", () => {
    const { container } = render(<DatasetSourceUrlSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["", " ", "\t", "\n", " \t\n "])(
    "omits the entire section for an empty or blank source URL %j",
    (url) => {
      const { container } = render(<DatasetSourceUrlSection url={url} />);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each([
    "https://data.gov/dataset/source?version=2#files",
    "http://data.gov/dataset/source",
    "https://example.com/datasets/very-long-url-here",
    "  https://data.gov/dataset/source  ",
  ])("preserves a supplied source URL %j and its link protections", (url) => {
    render(<DatasetSourceUrlSection url={url} />);

    expect(screen.getByRole("heading", { name: "Source URL" })).toBeVisible();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", url);
    expect(link.textContent).toBe(url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("reflects the current source when a dataset changes", () => {
    const { container, rerender } = render(
      <DatasetSourceUrlSection url="https://data.gov/first" />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://data.gov/first",
    );

    rerender(<DatasetSourceUrlSection />);
    expect(container).toBeEmptyDOMElement();

    rerender(<DatasetSourceUrlSection url="https://data.gov/second" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://data.gov/second",
    );
  });
});
