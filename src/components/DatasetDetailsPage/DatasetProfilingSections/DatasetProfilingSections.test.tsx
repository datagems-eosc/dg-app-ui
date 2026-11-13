import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import DatasetProfilingSections from "./DatasetProfilingSections";

it("groups multiple RecordSets with unambiguous names under each profiler heading", () => {
  render(
    <DatasetProfilingSections
      entries={[
        {
          id: "a",
          name: "Same",
          summary: "First summary",
          keywords: ["first"],
        },
        {
          id: "b",
          name: "Same",
          summary: "Second summary",
          keywords: ["second"],
        },
        { id: "c", name: undefined, summary: "Third summary", keywords: [] },
      ]}
    />,
  );
  const summaries = within(
    screen.getByRole("region", { name: "Profiling summary" }),
  );
  expect(
    summaries.getByRole("heading", { level: 4, name: "Same (1)" }),
  ).toBeInTheDocument();
  expect(
    summaries.getByRole("heading", { level: 4, name: "Same (2)" }),
  ).toBeInTheDocument();
  expect(
    summaries.getByRole("heading", { level: 4, name: "Record set 3" }),
  ).toBeInTheDocument();
  const keywords = within(
    screen.getByRole("region", { name: "Profiling keywords" }),
  );
  expect(keywords.getByText("first")).toBeInTheDocument();
  expect(keywords.getByText("second")).toBeInTheDocument();
  expect(
    keywords.queryByRole("heading", { name: "Record set 3" }),
  ).not.toBeInTheDocument();
});

it("distinguishes a supplied name from a coinciding neutral label", () => {
  render(
    <DatasetProfilingSections
      entries={[
        { id: "a", name: "Record set 2", summary: "First", keywords: [] },
        { id: "b", name: undefined, summary: "Second", keywords: [] },
      ]}
    />,
  );
  const headings = screen
    .getAllByRole("heading", { level: 4 })
    .map((heading) => heading.textContent);
  expect(new Set(headings).size).toBe(2);
});

it("uses safe Markdown and literal keywords, and removes old sections on rerender", () => {
  const literal = '<img src=x onerror="alert(1)">';
  const { container, rerender } = render(
    <DatasetProfilingSections
      entries={[
        {
          id: "a",
          name: undefined,
          summary:
            "**Safe text** [unsafe](javascript:alert(1))\n\n<script>alert(1)</script>\n\n[reference](https://example.org)",
          keywords: [literal],
        },
      ]}
    />,
  );
  expect(screen.getByText("Safe text").tagName).toBe("STRONG");
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText(literal)).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "unsafe" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "reference" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  rerender(
    <DatasetProfilingSections
      entries={[
        {
          id: "new",
          name: undefined,
          summary: undefined,
          keywords: ["Current"],
        },
      ]}
    />,
  );
  expect(
    screen.queryByRole("heading", { name: "Profiling summary" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Safe text")).not.toBeInTheDocument();
  expect(screen.getByText("Current")).toBeInTheDocument();
  rerender(<DatasetProfilingSections entries={[]} />);
  expect(container).toBeEmptyDOMElement();
});
