import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DatasetProposalBlock from "../DatasetProposalBlock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const datasets = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `d${i}`, title: `Dataset ${i}` }));

describe("DatasetProposalBlock", () => {
  it("asks to answer with the proposed datasets, naming the count", () => {
    render(<DatasetProposalBlock datasets={datasets(4)} onConfirm={vi.fn()} />);

    expect(
      screen.getByText(
        "These 4 datasets look relevant to your question. Use them to answer?",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Answer with these datasets" }),
    ).toBeEnabled();
  });

  it("uses the singular wording for one dataset", () => {
    render(<DatasetProposalBlock datasets={datasets(1)} onConfirm={vi.fn()} />);

    expect(
      screen.getByText(
        "This dataset looks relevant to your question. Use it to answer?",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Answer with this dataset" }),
    ).toBeEnabled();
  });

  it("disables the answer button once the proposal is resolved", () => {
    render(
      <DatasetProposalBlock
        datasets={datasets(2)}
        onConfirm={vi.fn()}
        isResolved
      />,
    );

    expect(
      screen.getByRole("button", { name: "Answer with these datasets" }),
    ).toBeDisabled();
  });
});
