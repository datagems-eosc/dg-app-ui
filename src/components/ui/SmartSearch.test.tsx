import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SmartSearch from "./SmartSearch";

const ON_TEXT = "Looks inside the data too. Results can take a few seconds.";
const OFF_TEXT = "Matches your keywords in dataset titles and descriptions.";

describe("SmartSearch – follows the toggle", () => {
  it("describes content search and shows the gradient when on", () => {
    const { container } = render(<SmartSearch enabled />);

    expect(screen.getByText("Smart search")).toBeInTheDocument();
    expect(screen.getByText(ON_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(OFF_TEXT)).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-smart", "on");
  });

  it("describes the keyword search and turns neutral when off", () => {
    const { container } = render(<SmartSearch enabled={false} />);

    expect(screen.getByText("Smart search")).toBeInTheDocument();
    expect(screen.getByText(OFF_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ON_TEXT)).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-smart", "off");
  });
});
