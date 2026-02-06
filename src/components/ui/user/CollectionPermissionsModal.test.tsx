import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionPermissionsModal } from "./CollectionPermissionsModal";

const mockUseApi = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

describe("CollectionPermissionsModal", () => {
  it("updates group permissions via context grants", async () => {
    const assignGroupCollectionGrant = vi.fn().mockResolvedValue(undefined);
    const unassignGroupCollectionGrant = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupCollectionGrants: vi
        .fn()
        .mockResolvedValue({ "collection-1": ["dg_col-browse"] }),
      assignGroupCollectionGrant,
      unassignGroupCollectionGrant,
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserCollectionGrants: vi.fn().mockResolvedValue({}),
      assignUserCollectionGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserCollectionGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <CollectionPermissionsModal
        isOpen
        collectionId="collection-1"
        collectionName="Collection One"
        onClose={vi.fn()}
      />,
    );

    const browseToggle = await screen.findByLabelText("Research Team Browse");
    expect(browseToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(browseToggle);

    await waitFor(() => {
      expect(unassignGroupCollectionGrant).toHaveBeenCalledWith(
        "group-1",
        "collection-1",
        "dg_col-browse",
      );
    });

    const downloadToggle = await screen.findByLabelText(
      "Research Team Download",
    );
    fireEvent.click(downloadToggle);

    await waitFor(() => {
      expect(assignGroupCollectionGrant).toHaveBeenCalledWith(
        "group-1",
        "collection-1",
        "dg_col-download",
      );
    });
  });
});
