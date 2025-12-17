import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AIMessageHeader } from "../AIMessageHeader";

describe("AIMessageHeader", () => {
  const defaultProps = {
    sources: undefined,
    onSourcesClick: undefined,
  };

  it("should render title and download button", () => {
    render(<AIMessageHeader {...defaultProps} />);

    expect(screen.getByText("DataGems AI")).toBeInTheDocument();

    const downloadButton = screen.getByRole("button", { name: /download/i });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();
  });

  it("should render sources button when sources > 0", () => {
    render(<AIMessageHeader sources={3} />);

    const sourcesButton = screen.getByRole("button", { name: /3 sources/i });
    expect(sourcesButton).toBeInTheDocument();
  });

  it("should render singular label when sources === 1", () => {
    render(<AIMessageHeader sources={1} />);

    const sourcesButton = screen.getByRole("button", { name: /1 source/i });
    expect(sourcesButton).toBeInTheDocument();
  });

  it("should not render sources button when sources is 0 or undefined", () => {
    const { rerender } = render(<AIMessageHeader />);

    expect(
      screen.queryByRole("button", { name: /source/i }),
    ).not.toBeInTheDocument();

    rerender(<AIMessageHeader sources={0} />);
    expect(
      screen.queryByRole("button", { name: /source/i }),
    ).not.toBeInTheDocument();
  });

  it("should call onSourcesClick when sources button is clicked", async () => {
    const user = userEvent.setup();
    const onSourcesClick = vi.fn();

    render(<AIMessageHeader sources={2} onSourcesClick={onSourcesClick} />);

    const sourcesButton = screen.getByRole("button", { name: /2 sources/i });
    await user.click(sourcesButton);

    expect(onSourcesClick).toHaveBeenCalledTimes(1);
  });

  it("should render both download and sources buttons when sources are provided", () => {
    render(<AIMessageHeader sources={5} />);

    expect(
      screen.getByRole("button", { name: /download/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /5 sources/i }),
    ).toBeInTheDocument();
  });
});
