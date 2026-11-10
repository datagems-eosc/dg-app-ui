import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bareWithData,
  envelopedEmpty,
  envelopedWithData,
  unrecognizedEnvelope,
} from "@/lib/languageAnalysis/fixtures";
import LanguageAnalysisPage from "./page";

/**
 * Composition proof for the Analysis Workspace: the stored linguistic-features
 * response goes through the real adapter and aggregation. Payloads are the
 * Gateway-shaped fixtures from `src/lib/languageAnalysis/fixtures.ts`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const EMPTY_MESSAGE = "No results for this feature.";

const store = (result: unknown) =>
  sessionStorage.setItem(
    "language_analysis",
    JSON.stringify({
      query: "Vienna",
      features: {
        termFrequency: true,
        sentimentProfile: true,
        collocations: true,
      },
      result,
    }),
  );

describe("LanguageAnalysisPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows panel data for the enveloped Gateway response", async () => {
    store(envelopedWithData);
    render(<LanguageAnalysisPage />);

    expect(await screen.findByText("vienna")).toBeInTheDocument();
    expect(screen.getByText("old town")).toBeInTheDocument();
    expect(screen.getByText("Vienna lies on the Danube.")).toBeInTheDocument();
    expect(screen.getByText("2 docs")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
  });

  it("renders a result stored before the fix", async () => {
    store(bareWithData);
    render(<LanguageAnalysisPage />);

    expect(await screen.findByText("vienna")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
  });

  it("shows placeholders, not an error, for a valid empty result", async () => {
    store(envelopedEmpty);
    render(<LanguageAnalysisPage />);

    expect(await screen.findAllByText(EMPTY_MESSAGE)).toHaveLength(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error instead of placeholders for an unrecognized response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store(unrecognizedEnvelope);
    render(<LanguageAnalysisPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not read this analysis",
    );
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).toContain("items");
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/Vienna/);
  });

  it("shows the error for a stored entry that is not valid JSON", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    sessionStorage.setItem("language_analysis", "{not json");
    render(<LanguageAnalysisPage />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
