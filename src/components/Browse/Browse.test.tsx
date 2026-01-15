import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Browse from "./Browse";

const mockUseApi = vi.fn();
const mockUseCollections = vi.fn();
const mockUseRouter = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => mockUseCollections(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => "/collections/custom/123",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Browse - Delete Collection Feature", () => {
  const mockDatasets = [
    {
      id: "1",
      title: "Test Dataset",
      description: "Test description",
      license: "MIT",
      size: "1 MB",
      datePublished: "2024-01-01",
      category: "Math" as const,
      access: "Open Access" as const,
      lastUpdated: "2024-01-01",
      tags: ["test"],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
    });

    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: vi.fn(),
      notifyCollectionModified: vi.fn(),
    });
  });

  it("should show Delete Collection button when user has dg_col-delete grant", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText("Delete Collection")).toBeInTheDocument();
    });
  });

  it("should NOT show Delete Collection button when user does not have dg_col-delete grant", async () => {
    const mockGetCollectionGrants = vi.fn().mockResolvedValue([]);

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.queryByText("Delete Collection")).not.toBeInTheDocument();
    });
  });

  it("should NOT check grants when isCustomCollection is false", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Math Collection"
        subtitle="System collection"
        isCustomCollection={false}
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).not.toHaveBeenCalled();
    });
  });

  it("should open delete modal when Delete Collection is clicked", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    await waitFor(() => {
      expect(
        screen.getByText(/This operation will permanently delete/i),
      ).toBeInTheDocument();
    });
  });

  it("should call deleteCollection API and show success toast", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);
    const mockDeleteCollection = vi.fn().mockResolvedValue({});
    const mockRefreshExtraCollections = vi.fn();
    const mockNotifyCollectionModified = vi.fn();
    const mockPush = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
      deleteCollection: mockDeleteCollection,
    });

    mockUseRouter.mockReturnValue({
      push: mockPush,
    });

    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: mockRefreshExtraCollections,
      notifyCollectionModified: mockNotifyCollectionModified,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    const confirmDeleteButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(mockDeleteCollection).toHaveBeenCalledWith("123");
      expect(mockRefreshExtraCollections).toHaveBeenCalled();
      expect(mockNotifyCollectionModified).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Collection deleted successfully!"),
      ).toBeInTheDocument();
    });
  });

  it("should show error toast when deletion fails", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);
    const mockDeleteCollection = vi
      .fn()
      .mockRejectedValue(new Error("API Error"));

    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: mockGetCollectionGrants,
      deleteCollection: mockDeleteCollection,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    const confirmDeleteButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to delete collection/i),
      ).toBeInTheDocument();
    });
  });
});
