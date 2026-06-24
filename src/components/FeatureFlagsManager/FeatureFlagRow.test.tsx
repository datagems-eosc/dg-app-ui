import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeatureFlagRow } from "./FeatureFlagRow";

describe("FeatureFlagRow", () => {
  it("shows the current value as a disabled switch with only an edit action in view mode", () => {
    render(
      <FeatureFlagRow label="Dataset packaging" value onSave={() => {}} />,
    );

    expect(screen.getByText("Dataset packaging")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Dataset packaging" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit Dataset packaging" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Dataset packaging" }),
    ).not.toBeInTheDocument();
  });

  it("saves the toggled value when editing then confirming", async () => {
    const onSave = vi.fn();
    render(<FeatureFlagRow label="Dataset packaging" value onSave={onSave} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Dataset packaging" }),
    );
    const toggle = screen.getByRole("button", { name: "Dataset packaging" });
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle); // true -> false
    await userEvent.click(
      screen.getByRole("button", { name: "Save Dataset packaging" }),
    );

    expect(onSave).toHaveBeenCalledWith(false);
  });

  it("discards the draft and does not save when cancelling", async () => {
    const onSave = vi.fn();
    render(
      <FeatureFlagRow
        label="Dataset packaging"
        value={false}
        onSave={onSave}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Dataset packaging" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dataset packaging" }),
    ); // draft false -> true
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel Dataset packaging" }),
    );

    expect(onSave).not.toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: "Dataset packaging" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toBeDisabled();
  });
});
