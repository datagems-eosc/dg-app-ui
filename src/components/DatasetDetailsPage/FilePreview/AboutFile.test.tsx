import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AboutFile from "./AboutFile";

it.each(["", "   "])(
  "hides an empty About this file section %j",
  (description) => {
    const { container } = render(<AboutFile description={description} />);
    expect(container).toBeEmptyDOMElement();
  },
);
it("keeps a supplied description", () => {
  render(<AboutFile description="Source description" />);
  expect(screen.getByText("Source description")).toBeInTheDocument();
});
