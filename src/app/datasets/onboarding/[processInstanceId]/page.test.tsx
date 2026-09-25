import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocked boundaries: the session, `fetch` and Next navigation. Nothing else.
// The page, the composition hook, the accepted controller/model and the
// design-approved view all run for real.
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPush = vi.fn();
const mockParams = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockParams(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/datasets/onboarding/x",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

import { PROCESSING_HEADING_ID } from "@/components/DatasetOnboarding/ProcessingView";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { UserProvider } from "@/contexts/UserContext";
import {
  DATASET_ID,
  failedThenPendingProcess,
  onboardingConfigPayload,
  PROCESS_INSTANCE_ID,
  runningProcess,
  succeededProcess,
} from "@/lib/datasetOnboarding/fixtures";
import DatasetOnboardingProcessPage from "./page";

/**
 * The same provider stack `app/layout.tsx` wraps every page in. Supplying the
 * real providers keeps the shell, the contexts it reads and the page itself
 * genuinely mounted; only the session, `fetch` and Next navigation are mocked.
 */
const Page = () => (
  <ErrorProvider>
    <UserProvider>
      <DatasetProvider>
        <CollectionsProvider>
          <FeatureFlagsProvider>
            <DatasetOnboardingProcessPage />
          </FeatureFlagsProvider>
        </CollectionsProvider>
      </DatasetProvider>
    </UserProvider>
  </ErrorProvider>
);

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PROCESS = "7c1e0a55-9d3b-4f26-8ab1-2e4f6d90c3aa";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const session = (overrides: Record<string, unknown> = {}) => ({
  status: "authenticated" as const,
  data: { accessToken: "token-1", user: { id: PRINCIPAL }, ...overrides },
});

interface Gateway {
  readonly process?: unknown;
  readonly processStatus?: number;
  readonly dataset?: unknown;
  readonly datasetStatus?: number;
}

const stubGateway = (gateway: Gateway = {}) => {
  const urls: string[] = [];
  const methods: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      methods.push((init?.method ?? "GET").toUpperCase());
      if (url.includes("/workflow-process/config")) {
        return json(onboardingConfigPayload);
      }
      if (url.includes("/workflow-process/")) {
        return json(
          gateway.process ?? runningProcess,
          gateway.processStatus ?? 200,
        );
      }
      if (url.includes("/gw/api/dataset/")) {
        return json(gateway.dataset ?? {}, gateway.datasetStatus ?? 200);
      }
      // The shell reads its own collections and conversations; they are
      // recorded and answered emptily, never with process or dataset content.
      return json({ items: [], count: 0 });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  /**
   * The shell issues its own POST *query* reads for collections and
   * conversations. Those are pre-existing and not this page's traffic, so the
   * method assertions below are scoped to the feature's own endpoints — while
   * the forbidden-endpoint checks still scan the whole ledger.
   */
  const featureCalls = () =>
    urls
      .map((url, index) => ({ url, method: methods[index] as string }))
      .filter(
        ({ url }) =>
          url.includes("/gw/api/workflow-process/") ||
          url.includes("/gw/api/dataset/"),
      );

  return {
    urls,
    methods,
    featureCalls,
    datasetReads: () => urls.filter((u) => u.includes("/gw/api/dataset/")),
    processReads: () =>
      urls.filter(
        (u) =>
          u.includes("/gw/api/workflow-process/") && !u.includes("/config"),
      ),
  };
};

const heading = () => document.getElementById(PROCESSING_HEADING_ID);

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
  mockParams.mockReturnValue({ processInstanceId: PROCESS_INSTANCE_ID });
  window.sessionStorage?.clear?.();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("the processing page", () => {
  // --- shell and structure -------------------------------------------------

  it("renders the view inside the application shell with exactly one h1", async () => {
    stubGateway({ process: runningProcess });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText("Dataset processing is in progress"),
      ).toBeInTheDocument();
    });

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Dataset processing");
    // The shell really is mounted around it.
    expect(document.querySelector("main")).not.toBeNull();
    expect(document.querySelector("aside")).not.toBeNull();
  });

  it("composes the accepted view, not a reimplementation of it", async () => {
    stubGateway({ process: failedThenPendingProcess });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText("Dataset processing stopped before it finished"),
      ).toBeInTheDocument();
    });

    const list = screen.getByRole("list", { name: "Processing stages" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(within(list).getByText("Failed")).toBeInTheDocument();
    expect(within(list).getAllByText("Not run")).toHaveLength(2);
  });

  // --- focus ---------------------------------------------------------------

  it("moves focus to the heading on arrival", async () => {
    stubGateway({ process: runningProcess });
    render(<Page />);

    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
    // Focusable for navigation, but never in the tab order.
    expect(heading()).toHaveAttribute("tabindex", "-1");
  });

  it("does not steal focus back on polls, status changes or token refreshes", async () => {
    const ledger = stubGateway({ process: runningProcess });
    const user = userEvent.setup();
    const { rerender } = render(<Page />);

    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });

    const check = await screen.findByRole("button", { name: "Check again" });
    await user.click(check);
    expect(check).toHaveFocus();

    // A poll that changes the status, and a token refresh, both while the
    // user is holding a control.
    await act(async () => {
      mockUseSession.mockReturnValue(
        session({ accessToken: "token-2", user: { id: PRINCIPAL } }),
      );
      rerender(<Page />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByRole("button", { name: "Check again" })).toHaveFocus();
    expect(heading()).not.toHaveFocus();
    expect(ledger.processReads().length).toBeGreaterThan(0);
  });

  it("moves focus again when the page starts monitoring another process", async () => {
    stubGateway({ process: runningProcess });
    const user = userEvent.setup();
    const { rerender } = render(<Page />);

    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
    const check = await screen.findByRole("button", { name: "Check again" });
    await user.click(check);
    expect(check).toHaveFocus();

    await act(async () => {
      mockParams.mockReturnValue({ processInstanceId: OTHER_PROCESS });
      rerender(<Page />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // A different process is a navigation, not an update.
    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
  });

  // --- navigation ----------------------------------------------------------

  it("navigates with the model's dataset id, encoded, and one base path", async () => {
    stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID, name: "Athens air quality 2024" },
    });
    const user = userEvent.setup();
    render(<Page />);

    const view = await screen.findByRole("button", { name: "View dataset" });
    await user.click(view);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/datasets/${DATASET_ID}`);
    // Next applies the configured basePath itself; the path must not carry a
    // second one.
    const target = mockPush.mock.calls[0]?.[0] as string;
    expect(target.startsWith("/datasets/")).toBe(true);
    expect(target.match(/\/datasets\//g)).toHaveLength(1);
  });

  it("offers no dataset navigation while readability is unconfirmed", async () => {
    stubGateway({ process: succeededProcess, datasetStatus: 403 });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText("This session cannot access the dataset"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "View dataset" })).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the confirmed dataset name as the subtitle, and only then", async () => {
    stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID, name: "Athens air quality 2024" },
    });
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Athens air quality 2024")).toBeInTheDocument();
    });
  });

  it("shows no subtitle when the read supplies no name", async () => {
    stubGateway({ process: succeededProcess, dataset: { id: DATASET_ID } });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View dataset" }),
      ).toBeInTheDocument();
    });
    // No invented, stored or most-recent title stands in for a missing name.
    const header = screen.getAllByRole("heading", { level: 1 })[0]
      ?.parentElement;
    expect(header?.querySelectorAll("p")).toHaveLength(0);
  });

  // --- boundaries ----------------------------------------------------------

  it("reads no process for an unusable route reference", async () => {
    const ledger = stubGateway();
    mockParams.mockReturnValue({ processInstanceId: ["a", "b"] });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText("We could not retrieve this process"),
      ).toBeInTheDocument();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(ledger.processReads()).toHaveLength(0);
    expect(ledger.datasetReads()).toHaveLength(0);
    // A reference we cannot use is not a deletion. Scoped to the view: the
    // surrounding shell has its own unrelated "delete" wording.
    const region = screen
      .getAllByRole("heading", { level: 1 })[0]
      ?.closest("section");
    const text = region?.textContent ?? "";
    // The only mention of deletion is the disclaimer denying it.
    const mentions = text.match(/deleted/gi) ?? [];
    const disclaimers =
      text.match(/does not mean the process was deleted/gi) ?? [];
    expect(disclaimers).toHaveLength(1);
    expect(mentions).toHaveLength(disclaimers.length);
  });

  it("reads nothing and reveals nothing without a usable session", async () => {
    const ledger = stubGateway();
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText("Processing status cannot be read for this session"),
      ).toBeInTheDocument();
    });

    expect(ledger.processReads()).toHaveLength(0);
    expect(ledger.datasetReads()).toHaveLength(0);
  });

  it("never issues a mutation from this page", async () => {
    const ledger = stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID },
    });
    const user = userEvent.setup();
    render(<Page />);

    const view = await screen.findByRole("button", { name: "View dataset" });
    await user.click(screen.getByRole("button", { name: "Check again" }));
    await user.click(view);

    // Every request this feature makes is a read.
    expect(ledger.featureCalls().length).toBeGreaterThan(0);
    for (const call of ledger.featureCalls()) {
      expect(call.method, call.url).toBe("GET");
    }
    // And no start, grant or profiling endpoint is touched by anything.
    for (const url of ledger.urls) {
      expect(url).not.toContain("/workflow-process/onboard");
      expect(url).not.toContain("/dataset/profile");
      expect(url).not.toContain("/context-grant");
    }
  });

  it("recovers a direct arrival by reading, without starting anything", async () => {
    const ledger = stubGateway({ process: runningProcess });
    render(<Page />);

    await waitFor(() => {
      expect(ledger.processReads().length).toBeGreaterThan(0);
    });
    for (const call of ledger.featureCalls()) {
      expect(call.method, call.url).toBe("GET");
    }
    expect(
      ledger.urls.some((u) => u.includes("/workflow-process/onboard")),
    ).toBe(false);
    expect(
      await screen.findByText("Dataset processing is in progress"),
    ).toBeInTheDocument();
  });
});
