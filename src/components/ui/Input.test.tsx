import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("gives the input element its name and keeps the label pointing at it", () => {
    render(<Input name="collectionName" label="Collection name" />);

    const input = screen.getByLabelText("Collection name");

    expect(input).toHaveAttribute("name", "collectionName");
    expect(input).toHaveAttribute("id", "collectionName");
  });

  it("renders without a name", () => {
    render(<Input placeholder="Type here" />);

    expect(screen.getByPlaceholderText("Type here")).not.toHaveAttribute(
      "name",
    );
  });
});
