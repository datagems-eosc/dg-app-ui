import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown from "./Markdown";

describe("Markdown", () => {
  it("renders headings, emphasis, lists, links and code", () => {
    const { container } = render(
      <Markdown
        content={[
          "## Heading",
          "",
          "**bold** and *italic*",
          "",
          "- one",
          "- two",
          "",
          "1. first",
          "2. second",
          "",
          "[example](https://example.com)",
          "",
          "`inline`",
          "",
          "```",
          "block",
          "```",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Heading" }),
    ).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelectorAll("code").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("pre")).toBeInTheDocument();
  });

  it("opens links in a new tab with a safe rel", () => {
    render(<Markdown content="[example](https://example.com)" />);

    const link = screen.getByRole("link", { name: "example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("strips raw HTML and script payloads", () => {
    const { container } = render(
      <Markdown content={"Hello<script>window.__pwned = true;</script>"} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Hello");
  });

  it("neutralises event-handler attributes on embedded HTML", () => {
    const { container } = render(
      <Markdown content={'<img src="x" onerror="window.__pwned = true;">'} />,
    );

    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("blocks javascript: URI schemes on links", () => {
    const { container } = render(
      <Markdown content={"[click](javascript:alert(1))"} />,
    );

    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href") ?? "").not.toContain("javascript:");
    }
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("renders nothing for empty content", () => {
    const { container } = render(<Markdown content="   " />);

    expect(container).toBeEmptyDOMElement();
  });
});
