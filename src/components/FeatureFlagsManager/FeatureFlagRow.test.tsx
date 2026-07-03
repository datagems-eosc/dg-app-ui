import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("does not render dataset ID input when onSaveDatasetId is not provided", () => {
    render(
      <FeatureFlagRow
        label="Dataset packaging"
        value={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/dataset id/i)).toBeNull();
  });
});

describe("FeatureFlagRow – with dataset ID override", () => {
  const label = "Use case – Weather - Dataset ID";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dataset ID input disabled in view mode", () => {
    render(
      <FeatureFlagRow
        label={label}
        value={false}
        onSave={vi.fn()}
        datasetId="abc-123"
        onSaveDatasetId={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(`Dataset ID for ${label}`);
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input).toHaveValue("abc-123");
  });

  it("enables dataset ID input when editing", async () => {
    render(
      <FeatureFlagRow
        label={label}
        value={false}
        onSave={vi.fn()}
        datasetId="abc-123"
        onSaveDatasetId={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Edit ${label}` }),
    );
    expect(screen.getByLabelText(`Dataset ID for ${label}`)).toBeEnabled();
  });

  it("calls onSaveDatasetId with entered value on save", async () => {
    const onSaveDatasetId = vi.fn();
    render(
      <FeatureFlagRow
        label={label}
        value={false}
        onSave={vi.fn()}
        datasetId=""
        onSaveDatasetId={onSaveDatasetId}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Edit ${label}` }),
    );
    await userEvent.type(
      screen.getByLabelText(`Dataset ID for ${label}`),
      "new-id-456",
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Save ${label}` }),
    );
    expect(onSaveDatasetId).toHaveBeenCalledWith("new-id-456");
  });

  it("resets dataset ID input to original value on cancel", async () => {
    render(
      <FeatureFlagRow
        label={label}
        value={false}
        onSave={vi.fn()}
        datasetId="original-id"
        onSaveDatasetId={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Edit ${label}` }),
    );
    const input = screen.getByLabelText(`Dataset ID for ${label}`);
    await userEvent.clear(input);
    await userEvent.type(input, "changed-id");
    await userEvent.click(
      screen.getByRole("button", { name: `Cancel ${label}` }),
    );
    expect(screen.getByLabelText(`Dataset ID for ${label}`)).toHaveValue(
      "original-id",
    );
  });
});
