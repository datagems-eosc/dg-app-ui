import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

let session: { user: { name: string } } | null = { user: { name: "Test" } };

const collections = {
  refreshAllCollections: vi.fn(),
  isLoadingApiCollections: false,
  isLoadingExtraCollections: false,
};

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => collections,
}));
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ hasToken: true }) }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: session }),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/browse",
}));
vi.mock("@ui/SidebarContent", () => ({ SidebarContent: () => null }));
vi.mock("@ui/SidebarHeader", () => ({ SidebarHeader: () => null }));
vi.mock("@ui/MainHeader", () => ({ MainHeader: () => null }));
vi.mock("../CollectionSettingsModal", () => ({ default: () => null }));

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session = { user: { name: "Test" } };
    collections.isLoadingApiCollections = false;
    collections.isLoadingExtraCollections = false;
  });

  it("does not ask for the collection list again while it is loading", () => {
    collections.isLoadingApiCollections = true;
    collections.isLoadingExtraCollections = true;

    render(<DashboardLayout>page</DashboardLayout>);

    expect(screen.getByText("page")).toBeInTheDocument();
    expect(collections.refreshAllCollections).not.toHaveBeenCalled();
  });

  it("does not ask once the first load finishes", () => {
    collections.isLoadingApiCollections = true;
    collections.isLoadingExtraCollections = true;
    const { rerender } = render(<DashboardLayout>page</DashboardLayout>);

    collections.isLoadingApiCollections = false;
    collections.isLoadingExtraCollections = false;
    rerender(<DashboardLayout>page</DashboardLayout>);

    expect(collections.refreshAllCollections).not.toHaveBeenCalled();
  });

  it("refreshes the collection list once when a page opens after it loaded", () => {
    const { rerender } = render(<DashboardLayout>page</DashboardLayout>);
    rerender(<DashboardLayout>page</DashboardLayout>);

    expect(collections.refreshAllCollections).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing while signed out", () => {
    session = null;

    render(<DashboardLayout>page</DashboardLayout>);

    expect(collections.refreshAllCollections).not.toHaveBeenCalled();
  });
});
