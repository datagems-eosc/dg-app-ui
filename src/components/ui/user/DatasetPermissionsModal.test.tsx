import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatasetPermissionsModal } from "./DatasetPermissionsModal";

const mockUseApi = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

describe("DatasetPermissionsModal", () => {
  it("updates group permissions via context grants", async () => {
    const assignGroupDatasetGrant = vi.fn().mockResolvedValue(undefined);
    const unassignGroupDatasetGrant = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupDatasetGrants: vi
        .fn()
        .mockResolvedValue({ "dataset-1": ["dg_ds-browse"] }),
      assignGroupDatasetGrant,
      unassignGroupDatasetGrant,
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    const browseToggle = await screen.findByLabelText("Research Team Browse");
    expect(browseToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(browseToggle);

    await waitFor(() => {
      expect(unassignGroupDatasetGrant).toHaveBeenCalledWith(
        "group-1",
        "dataset-1",
        "dg_ds-browse",
      );
    });

    const downloadToggle = await screen.findByLabelText(
      "Research Team Download",
    );
    fireEvent.click(downloadToggle);

    await waitFor(() => {
      expect(assignGroupDatasetGrant).toHaveBeenCalledWith(
        "group-1",
        "dataset-1",
        "dg_ds-download",
      );
    });
  });

  it("removes user permissions when user is removed", async () => {
    const unassignUserDatasetGrant = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({
        items: [
          {
            id: "user-1",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
        ],
      }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({
        "dataset-1": ["dg_ds-browse", "dg_ds-download"],
      }),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant,
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText("Invite by E-mail"));
    const emailInput = screen.getByPlaceholderText("Enter e-mail");
    fireEvent.change(emailInput, { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByText("Invite"));

    const removeButton = await screen.findByLabelText("Remove Ada Lovelace");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(unassignUserDatasetGrant).toHaveBeenCalledWith(
        "user-1",
        "dataset-1",
        "dg_ds-browse",
      );
      expect(unassignUserDatasetGrant).toHaveBeenCalledWith(
        "user-1",
        "dataset-1",
        "dg_ds-download",
      );
    });
  });

  it("filters groups with Manage Groups selection", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [
          { id: "group-1", name: "Research Team" },
          { id: "group-2", name: "Analytics" },
        ],
      }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Research Team")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    const manageDialog = await screen.findByLabelText("Manage Groups");

    const groupCheckbox = document.getElementById("group-group-2");
    const groupCheckboxWrapper = groupCheckbox?.parentElement?.parentElement;
    if (!groupCheckboxWrapper) {
      throw new Error("Group checkbox not found");
    }
    fireEvent.click(groupCheckboxWrapper);

    fireEvent.click(within(manageDialog).getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
      expect(screen.getByText("Research Team")).toBeInTheDocument();
    });
  });
});
