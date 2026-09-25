import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { KeywordInput } from "./KeywordInput";

function Field({
  maxItems,
  initial = [],
}: {
  maxItems?: number;
  initial?: string[];
}) {
  const [values, setValues] = useState(initial);
  return (
    <KeywordInput
      label="Country"
      value={values}
      onChange={setValues}
      maxItems={maxItems}
    />
  );
}

describe("KeywordInput optional item limit", () => {
  it("keeps multi-value entry available by default", async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByRole("textbox"), "US,PL{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove US" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove PL" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it.each(["US, PL", "US,US", "US,PL,"])(
    "rejects a pasted list %s on Enter and blur without choosing a value",
    async (input) => {
      const user = userEvent.setup();
      render(<Field maxItems={1} />);
      const field = screen.getByRole("textbox");
      await user.click(field);
      await user.paste(input);
      await user.keyboard("{Enter}");
      await user.tab();
      expect(screen.getByText("Add only one value.")).toBeInTheDocument();
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription("Add only one value.");
      expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    },
  );

  it("blocks more entry after comma, keeps removal usable and allows a replacement on blur", async () => {
    const user = userEvent.setup();
    render(<Field maxItems={1} />);
    const field = screen.getByRole("textbox");
    await user.type(field, "US,");
    expect(field).toBeDisabled();
    await user.type(field, "PL{Enter}");
    expect(screen.queryByRole("button", { name: "Remove PL" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove US" }));
    expect(field).toBeEnabled();
    await user.type(field, "PL");
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Remove PL" }),
    ).toBeInTheDocument();
    expect(field).toBeDisabled();
  });

  it("does not truncate existing multiple values and lets the user remove them", async () => {
    const user = userEvent.setup();
    render(<Field maxItems={1} initial={["US", "PL"]} />);
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(2);
    expect(screen.getByRole("textbox")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove US" }));
    await user.click(screen.getByRole("button", { name: "Remove PL" }));
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
