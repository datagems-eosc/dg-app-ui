import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();
const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

// The application shell. It is unrelated to onboarding and makes its own
// requests; the real shell around this page is covered by the browser evidence.
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [],
    isLoadingApiCollections: false,
    extraCollections: [],
    refreshExtraCollections: vi.fn(),
    notifyCollectionModified: vi.fn(),
  }),
}));

import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import DatasetsLayout from "../layout";
import AddDatasetPage from "./page";

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";

const stubFetch = () => {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/storage/upload/allowed-extension")) {
        return new Response(JSON.stringify([".csv"]), { status: 200 });
      }
      if (url.includes("/vocabulary/")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 500,
      });
    }),
  );
  return urls;
};

const setFlags = (overrides: Record<string, boolean>) => {
  window.localStorage.setItem(
    FEATURE_FLAGS_STORAGE_KEY,
    JSON.stringify(overrides),
  );
};

/** The real route composition: `app/datasets/layout.tsx` around the page. */
const mountRoute = () =>
  render(
    <FeatureFlagsProvider>
      <DatasetsLayout>
        <AddDatasetPage />
      </DatasetsLayout>
    </FeatureFlagsProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "token-1", user: { id: PRINCIPAL } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/datasets/add", () => {
  it("composes the shared onboarding owner around the form without starting anything", async () => {
    const urls = stubFetch();
    setFlags({ datasetOnboarding: true, datasetOnboardingMonitoring: true });

    mountRoute();

    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add new dataset" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Start processing" }),
      ).toBeEnabled();
    });

    // Reaching the route reads the uploader's allowed extensions and the
    // vocabularies the form needs — and starts no workflow process.
    expect(urls.filter((url) => url.includes("/workflow-process"))).toEqual([]);
    expect(urls.filter((url) => url.includes("/dataset/onboard"))).toEqual([]);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("still redirects away when the onboarding availability flag is off", async () => {
    stubFetch();
    setFlags({ datasetOnboarding: false, datasetOnboardingMonitoring: true });

    mountRoute();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("heading", { name: "Add new dataset" }),
    ).toBeNull();
  });

  it("keeps the page reachable when only the rollout flag is off", async () => {
    stubFetch();
    setFlags({ datasetOnboarding: true, datasetOnboardingMonitoring: false });

    mountRoute();

    // The page renders; it is the submission that is disabled, so an existing
    // process stays explainable and the form states stay reachable.
    await waitFor(() => {
      expect(
        screen.getByText("Adding datasets is currently unavailable"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Start processing" }),
    ).toBeDisabled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
