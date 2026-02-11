import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddDatasetForm from "./AddDatasetForm";

const mockUseApi = vi.fn();
const mockUseRouter = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { accessToken: "token" },
    status: "authenticated",
  }),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [],
    extraCollections: [],
    refreshExtraCollections: vi.fn(),
    notifyCollectionModified: vi.fn(),
  }),
}));

describe("AddDatasetForm", () => {
  const mockGetUploadAllowedExtensions = vi
    .fn()
    .mockResolvedValue([".csv", ".pdf"]);
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUploadAllowedExtensions.mockResolvedValue([".csv", ".pdf"]);

    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUseApi.mockReturnValue({
      hasToken: true,
      getUploadAllowedExtensions: mockGetUploadAllowedExtensions,
      uploadDatasetFiles: vi.fn().mockResolvedValue(["/staged/file1.csv"]),
      onboardDataset: vi.fn().mockResolvedValue("dataset-uuid-123"),
      profileDataset: vi.fn().mockResolvedValue("dataset-uuid-123"),
      getFieldsOfScience: vi.fn().mockResolvedValue([]),
      getLicenses: vi.fn().mockResolvedValue([]),
    });
  });

  it("renders form sections", () => {
    render(<AddDatasetForm />);

    expect(screen.getByText("Dataset upload")).toBeInTheDocument();
    expect(screen.getByText("Basic information")).toBeInTheDocument();
    expect(screen.getByText("Classification")).toBeInTheDocument();
    expect(screen.getByText("Additional Information")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Publish Dataset/i }),
    ).toBeInTheDocument();
  });

  it("calls getUploadAllowedExtensions on mount", async () => {
    render(<AddDatasetForm />);

    await waitFor(() => {
      expect(mockGetUploadAllowedExtensions).toHaveBeenCalled();
    });
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<AddDatasetForm />);

    const publishButtons = screen.getAllByRole("button", {
      name: /Publish Dataset/i,
    });
    await user.click(publishButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByText("At least one file must be uploaded"),
      ).toBeInTheDocument();
    });
  });

  it("validates required basic info fields", async () => {
    const user = userEvent.setup();
    render(<AddDatasetForm />);

    const publishButtons = screen.getAllByRole("button", {
      name: /Publish Dataset/i,
    });
    await user.click(publishButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });
  });
});
