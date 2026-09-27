import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

import { PROCESS_INSTANCE_ID } from "@/lib/datasetOnboarding/fixtures";
import type {
  RetainedFile,
  SubmissionRequest,
} from "@/lib/datasetOnboarding/submission";
import { DatasetOnboardingSessionBoundary } from "./DatasetOnboardingSessionBoundary";
import { useOnboardingSession } from "./OnboardingSessionProvider";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// Only the session and `fetch` are mocked. `useApi`, `makeRequest`,
// `fetchWithAuth`, the accepted adapter, the accepted submission controller and
// the accepted provider all run for real, so the request ledger below is the
// one a browser would produce for this composition.

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";

const session = (
  options: {
    readonly userId?: unknown;
    readonly accessToken?: string;
    readonly status?: "loading" | "authenticated" | "unauthenticated";
  } = {},
) => {
  const status = options.status ?? "authenticated";
  const accessToken =
    "accessToken" in options ? options.accessToken : "token-1";
  const userId = "userId" in options ? options.userId : PRINCIPAL;
  return {
    status,
    data:
      status === "unauthenticated"
        ? null
        : {
            ...(accessToken === undefined ? {} : { accessToken }),
            ...(userId === undefined ? {} : { user: { id: userId } }),
          },
  };
};

interface Ledger {
  readonly urls: string[];
  readonly methods: string[];
  readonly bodies: string[];
  release: () => void;
}

/**
 * A fake HTTP boundary that holds the start open until a test releases it, so
 * "a repeat while one is in flight sends nothing more" is observable.
 */
const stubFetch = (answer: () => Response): Ledger => {
  const urls: string[] = [];
  const methods: string[] = [];
  const bodies: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      methods.push((init?.method ?? "GET").toUpperCase());
      bodies.push(typeof init?.body === "string" ? init.body : "");
      await gate;
      return answer();
    }),
  );

  const ledger: Ledger = {
    urls,
    methods,
    bodies,
    release: () => release(),
  };
  return ledger;
};

const accepted = () =>
  new Response(JSON.stringify({ id: PROCESS_INSTANCE_ID }), { status: 200 });

const file = (reference: string): RetainedFile => ({
  id: reference,
  name: `${reference}.csv`,
  status: "success",
  stagedPath: reference,
});

const request = (reference = "staged/one.csv"): SubmissionRequest => ({
  files: [file(reference)],
  metadata: {
    name: "Sensor readings 2026",
    description: "Hourly readings from the pilot network.",
    license: "CC-BY-4.0",
    headline: "Pilot network readings",
    keywords: ["sensors"],
    fieldOfScience: ["Environmental science"],
    datePublished: "2026-09-23",
  },
  sharing: null,
});

/** A consumer that only reports and acts; it owns no submission state. */
const Consumer = ({ reference }: { reference?: string }) => {
  const submission = useOnboardingSession();
  return (
    <div>
      <p data-testid="status">{submission.status}</p>
      <p data-testid="process">{submission.processInstanceId ?? "none"}</p>
      <p data-testid="blocked">{submission.blocked?.kind ?? "none"}</p>
      <button
        type="button"
        onClick={() => submission.submit(request(reference))}
      >
        Start
      </button>
    </div>
  );
};

const mount = (children = <Consumer />) =>
  render(
    <DatasetOnboardingSessionBoundary>
      {children}
    </DatasetOnboardingSessionBoundary>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
  window.sessionStorage?.clear?.();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("DatasetOnboardingSessionBoundary", () => {
  it("adds no markup and performs no request when it is mounted", async () => {
    const ledger = stubFetch(accepted);

    const { container } = render(
      <DatasetOnboardingSessionBoundary>
        <p data-testid="child">child</p>
      </DatasetOnboardingSessionBoundary>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    // Exactly the child, with no wrapper element around it.
    expect(container.innerHTML).toBe('<p data-testid="child">child</p>');
    // Installing the owner starts nothing: no start, no read, no config.
    expect(ledger.urls).toEqual([]);
  });

  it("sends exactly one start for a repeated action and keeps the process", async () => {
    const user = userEvent.setup();
    const ledger = stubFetch(accepted);
    mount();

    const start = screen.getByRole("button", { name: "Start" });
    await user.click(start);
    await user.click(start);
    await user.click(start);

    expect(screen.getByTestId("status")).toHaveTextContent("starting");
    expect(screen.getByTestId("blocked")).toHaveTextContent("already-starting");

    await act(async () => {
      ledger.release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("accepted");
    });

    expect(ledger.urls).toHaveLength(1);
    expect(ledger.urls[0]).toBe(
      `${API_BASE}/gw/api/workflow-process/onboard?f=id`,
    );
    expect(ledger.methods).toEqual(["POST"]);
    expect(screen.getByTestId("process")).toHaveTextContent(
      PROCESS_INSTANCE_ID,
    );

    const body = JSON.parse(ledger.bodies[0] as string);
    expect(body.dataLocations).toEqual([
      { kind: 0, location: "staged/one.csv" },
    ]);
    // Nothing about sharing, grants or collections is on the wire.
    for (const absent of ["sharing", "groups", "collection", "accessType"]) {
      expect(body).not.toHaveProperty(absent);
    }
  });

  it("keeps the same owner across a same-principal token refresh", async () => {
    const user = userEvent.setup();
    const ledger = stubFetch(accepted);
    const { rerender } = mount();

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("status")).toHaveTextContent("starting");

    // A refreshed token produces a new session object and therefore a new
    // adapter. That is not a scope change, so the pending attempt must survive
    // it — and no second request may be sent.
    mockUseSession.mockReturnValue(session({ accessToken: "token-2" }));
    rerender(
      <DatasetOnboardingSessionBoundary>
        <Consumer />
      </DatasetOnboardingSessionBoundary>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("starting");

    await act(async () => {
      ledger.release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("accepted");
    });
    expect(ledger.urls).toHaveLength(1);
    expect(screen.getByTestId("process")).toHaveTextContent(
      PROCESS_INSTANCE_ID,
    );
  });

  it("isolates a changed principal instead of revealing the earlier attempt", async () => {
    const user = userEvent.setup();
    const ledger = stubFetch(accepted);
    const { rerender } = mount();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      ledger.release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("accepted");
    });

    mockUseSession.mockReturnValue(session({ userId: OTHER_PRINCIPAL }));
    rerender(
      <DatasetOnboardingSessionBoundary>
        <Consumer />
      </DatasetOnboardingSessionBoundary>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("process")).toHaveTextContent("none");
    expect(ledger.urls).toHaveLength(1);
  });

  it("refuses to submit without a resolved identity, and sends nothing", async () => {
    const user = userEvent.setup();
    const ledger = stubFetch(accepted);
    mockUseSession.mockReturnValue(session({ userId: undefined }));
    mount();

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByTestId("blocked")).toHaveTextContent(
      "identity-unavailable",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(ledger.urls).toEqual([]);
  });
});
