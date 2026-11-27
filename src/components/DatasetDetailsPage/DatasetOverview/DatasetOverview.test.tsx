import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatasetPlus } from "@/data/dataset";
import DatasetOverview from "./DatasetOverview";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Synthetic values only. */
const base: DatasetPlus = {
  id: "ds-1",
  title: "Algebra problems",
  category: "Math",
  description: "Word problems with **rationales**.",
  size: "",
  lastUpdated: "",
  tags: [],
};

const full: DatasetPlus = {
  ...base,
  fieldOfScience: ["Mathematics", "Computer and information sciences"],
  keywords: ["algebra", "rationales"],
  language: "en",
  country: "GB",
  url: "https://github.com/example/algebra",
  license: "Apache-2.0",
  citation: "Doe, J. (2017). Algebra problems. Example Press.",
};

const renderOverview = (
  dataset: DatasetPlus,
  props: Partial<React.ComponentProps<typeof DatasetOverview>> = {},
) =>
  render(
    <DatasetOverview
      dataset={dataset}
      aside={<aside aria-label="Permissions and collections" />}
      {...props}
    />,
  );

const sectionTitles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

/** The value a label stands above. */
const fieldValue = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

describe("DatasetOverview", () => {
  it("shows the description first, then each section with labels above values", () => {
    renderOverview(full);
    const region = screen.getByRole("region", { name: "Overview" });
    const text = region.textContent ?? "";
    expect(text.indexOf("Word problems")).toBeLessThan(
      text.indexOf("Classification"),
    );
    expect(
      within(region).getByText("rationales", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(sectionTitles()).toEqual([
      "Classification",
      "Characteristics",
      "Source & licensing",
      "Citation",
    ]);
    expect(
      within(fieldValue("Fields of science")).getByRole("list", {
        name: "Fields of science",
      }),
    ).toHaveTextContent("MathematicsComputer and information sciences");
    expect(
      within(fieldValue("Keywords")).getByRole("list", { name: "Keywords" }),
    ).toBeInTheDocument();
    expect(fieldValue("Language")).toHaveTextContent("English");
    expect(fieldValue("Country")).toHaveTextContent("United Kingdom");
    expect(within(fieldValue("Source")).getByRole("link")).toHaveAttribute(
      "href",
      "https://github.com/example/algebra",
    );
    expect(fieldValue("License")).toHaveTextContent("Apache-2.0");
    expect(screen.getByText(full.citation as string)).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", {
        name: "Permissions and collections",
      }),
    ).toBeInTheDocument();
  });

  it("renders no section, title or label when every metadata value is absent", () => {
    renderOverview({
      ...base,
      fieldOfScience: [],
      keywords: [" "],
      language: "None",
      country: "",
      url: "  ",
      license: "",
      citation: "  ",
    });
    expect(screen.queryAllByRole("heading", { level: 3 })).toEqual([]);
    expect(screen.queryAllByRole("term")).toEqual([]);
  });

  it("skips malformed list entries and unknown codes instead of showing them", () => {
    renderOverview({
      ...base,
      fieldOfScience: [null, 7, "  "] as unknown as string[],
      keywords: [
        undefined,
        "air quality",
        "Air Quality",
      ] as unknown as string[],
      language: "xx, ,None",
      country: "ZZ",
    });
    expect(sectionTitles()).toEqual(["Classification"]);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Keywords",
    ]);
    expect(
      within(fieldValue("Keywords")).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("shows only the values present, with no label for the missing ones", () => {
    renderOverview({ ...base, keywords: ["air quality"], license: "CC0 1.0" });
    expect(sectionTitles()).toEqual(["Classification", "Source & licensing"]);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Keywords",
      "License",
    ]);
  });

  it("keeps a lone Characteristics group in the first column", () => {
    renderOverview({ ...base, language: "en,el", country: "GR" });
    expect(sectionTitles()).toEqual(["Characteristics"]);
    expect(fieldValue("Languages")).toHaveTextContent("English, Greek");
    const group = screen.getByRole("heading", {
      name: "Characteristics",
    }).parentElement;
    expect(group?.parentElement?.firstElementChild).toBe(group);
  });

  it("keeps a lone Source & licensing group in the first column", () => {
    renderOverview({ ...base, url: "https://example.org/data" });
    expect(sectionTitles()).toEqual(["Source & licensing"]);
    const group = screen.getByRole("heading", {
      name: "Source & licensing",
    }).parentElement;
    expect(group?.parentElement?.firstElementChild).toBe(group);
  });

  it("names several languages and countries in full as plain text", () => {
    renderOverview({ ...base, language: "en, fr,de", country: "GR,PT,US" });
    expect(fieldValue("Languages")).toHaveTextContent(
      "English, French, German",
    );
    expect(fieldValue("Countries")).toHaveTextContent(
      "Greece, Portugal, United States",
    );
    expect(
      within(fieldValue("Countries")).queryByRole("list"),
    ).not.toBeInTheDocument();
  });

  it("shows one Source and license field when both are the same address", () => {
    renderOverview({
      ...base,
      url: "https://cds.example.eu/datasets/era5-land",
      license: "http://cds.example.eu/datasets/era5-land/",
    });
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Source and license",
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("links a licence given as a different address, and wraps a long licence text in full", () => {
    const { unmount } = renderOverview({
      ...base,
      url: "https://example.org/source",
      license: "https://example.org/licence",
    });
    expect(within(fieldValue("License")).getByRole("link")).toHaveAttribute(
      "href",
      "https://example.org/licence",
    );
    unmount();
    const long =
      "Riksdagens öppna data — free reuse with attribution (Källa: Sveriges riksdag), see the terms published with each release";
    renderOverview({ ...base, license: long });
    expect(fieldValue("License")).toHaveTextContent(long);
    expect(
      within(fieldValue("License")).queryByRole("link"),
    ).not.toBeInTheDocument();
  });

  it("shows a source that is not a web address as text, never as a link", () => {
    renderOverview({ ...base, url: "javascript:alert(1)" });
    expect(fieldValue("Source")).toHaveTextContent("javascript:alert(1)");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows placeholders while the fields-of-science names load", () => {
    renderOverview(
      { ...base, fieldOfScience: ["1.1", "1.2"] },
      { fieldsOfSciencePending: true },
    );
    expect(
      within(fieldValue("Fields of science")).getByRole("status", {
        name: "Loading fields of science",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("1.1")).not.toBeInTheDocument();
  });

  it("says so when the dataset has no description", () => {
    renderOverview({ ...base, description: "  " });
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  describe("citation", () => {
    it("copies the citation and confirms it, then returns to Copy", async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      renderOverview(full);
      const button = screen.getByRole("button", { name: "Copy citation" });
      await act(async () => fireEvent.click(button));
      expect(writeText).toHaveBeenCalledWith(full.citation);
      expect(button).toHaveTextContent("Copied");
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(button).toHaveTextContent("Copy");
    });

    it("tells the user when copying fails", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
        configurable: true,
      });
      renderOverview(full);
      const button = screen.getByRole("button", { name: "Copy citation" });
      await act(async () => fireEvent.click(button));
      expect(button).toHaveTextContent("Copy failed");
    });

    it("leaves the Citation section out without a citation", () => {
      renderOverview({ ...full, citation: undefined });
      expect(sectionTitles()).not.toContain("Citation");
      expect(
        screen.queryByRole("button", { name: "Copy citation" }),
      ).not.toBeInTheDocument();
    });
  });
});
