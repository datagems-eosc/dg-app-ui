import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gatewayErrorFromResponse } from "@/lib/gatewayError";

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
 * UI #375, observed 10 November: a meaningless question showed "error
 * communicating with underpinning service". The page now shows the classified
 * message with its reference.
 */
describe("LanguageQuestionPage failed analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the unanswerable message and reference, not the Gateway text", async () => {
    api.getLinguisticFeatures.mockRejectedValue(
      gatewayErrorFromResponse(424, {
        code: 104,
        error: "error communicating with underpinning service",
        message: {
          statusCode: 422,
          source: "InDataExploration",
          correlationId: "50c7a41b-757f-440d-a4e8-eef5be144cb2",
          payload: null,
        },
      }),
    );
    render(<LanguageQuestionPage />);

    fireEvent.change(screen.getByPlaceholderText("Ask a question..."), {
      target: { value: "qwzx vbnm plok" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Ask a question..."), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

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
