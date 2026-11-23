import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gatewayErrorFromResponse } from "@/lib/gatewayError";
import { upstreamFailureBody } from "@/lib/gatewayError.fixtures";

const api = { getLinguisticFeatures: vi.fn(), queryDatasets: vi.fn() };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useApi", () => ({ useApi: () => api }));
vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    flags: { pinnedDatasetLanguage: true },
    datasetIds: { pinnedDatasetLanguage: "d-1" },
  }),
}));

import LanguageQuestionPage from "./page";

/**
 * A meaningless question used to show "error
 * communicating with underpinning service". The page now shows the classified
 * message with its reference.
 */
const askAndStart = () => {
  render(<LanguageQuestionPage />);
  fireEvent.change(screen.getByPlaceholderText("Ask a question..."), {
    target: { value: "qwzx vbnm plok" },
  });
  fireEvent.keyDown(screen.getByPlaceholderText("Ask a question..."), {
    key: "Enter",
  });
  fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));
};

describe("LanguageQuestionPage failed analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the rephrase message, not the service's technical text", async () => {
    const payload = JSON.stringify({
      code: 102,
      error: "validation error",
      message: [
        { Key: "question", Value: ["No valid RAG results were provided."] },
      ],
    });
    api.getLinguisticFeatures.mockRejectedValue(
      gatewayErrorFromResponse(
        424,
        upstreamFailureBody(400, "InDataExploration", payload),
      ),
    );
    askAndStart();

    expect(
      await screen.findByText(
        "This question can't be answered from the selected data. Try rephrasing it. Reference: 50c7a41b",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No valid RAG results/)).not.toBeInTheDocument();
  });

  it("shows the unavailable message for a service failure", async () => {
    api.getLinguisticFeatures.mockRejectedValue(
      gatewayErrorFromResponse(424, upstreamFailureBody(503)),
    );
    askAndStart();

    expect(
      await screen.findByText(
        "The service is temporarily unavailable. Please try again. Reference: 50c7a41b",
      ),
    ).toBeInTheDocument();
  });

  it("shows fixed copy, not the parser's text, when the answer is unreadable", async () => {
    api.getLinguisticFeatures.mockRejectedValue(
      new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON"),
    );
    askAndStart();

    expect(
      await screen.findByText("Analysis failed. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
  });

  it("keeps a message the UI wrote itself, such as a missing session token", async () => {
    api.getLinguisticFeatures.mockRejectedValue(
      new Error("No authentication token available"),
    );
    askAndStart();

    expect(
      await screen.findByText("No authentication token available"),
    ).toBeInTheDocument();
  });

  it("shows the unanswerable message and reference, not the Gateway text", async () => {
    api.getLinguisticFeatures.mockRejectedValue(
      gatewayErrorFromResponse(424, upstreamFailureBody(422)),
    );
    askAndStart();

    expect(
      await screen.findByText(
        "This question can't be answered from the selected data. Try rephrasing it. Reference: 50c7a41b",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/underpinning service/)).not.toBeInTheDocument();
    expect(api.getLinguisticFeatures).toHaveBeenCalledWith({
      DatasetIds: ["d-1"],
      Query: "qwzx vbnm plok",
    });
  });
});
