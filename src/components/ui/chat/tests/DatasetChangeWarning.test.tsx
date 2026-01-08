import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DatasetChangeWarning from "../DatasetChangeWarning";

vi.mock("lucide-react", () => ({
  Info: ({ className }: { className?: string }) => (
    <svg data-testid="info-icon" className={className} aria-label="Info icon">
      Info
    </svg>
  ),
}));

describe("DatasetChangeWarning", () => {
  it("should not render when isVisible is false", () => {
    const { container } = render(<DatasetChangeWarning isVisible={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("should render when isVisible is true", () => {
    render(<DatasetChangeWarning isVisible={true} />);

    expect(
      screen.getByText(
        "The selected datasets have changed. The AI will respond based on the updated list.",
      ),
    ).toBeInTheDocument();
  });

  it("should render Info icon", () => {
    render(<DatasetChangeWarning isVisible={true} />);

    const icon = screen.getByTestId("info-icon");
    expect(icon).toBeInTheDocument();
  });

  it("should display warning message", () => {
    render(<DatasetChangeWarning isVisible={true} />);

    const message = screen.getByText(/The selected datasets have changed/i);
    expect(message).toBeInTheDocument();
    expect(message).toHaveTextContent(
      "The selected datasets have changed. The AI will respond based on the updated list.",
    );
  });
});
