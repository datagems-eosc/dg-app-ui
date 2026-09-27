import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OnboardingStartOperations } from "@/hooks/useDatasetOnboardingSubmission";
import {
  SESSION_RECORD_KEY,
  type SessionStorageLike,
} from "@/lib/datasetOnboarding/recovery";
import type {
  RetainedFile,
  SharingIntent,
  SubmissionRequest,
} from "@/lib/datasetOnboarding/submission";
import {
  asProcessInstanceId,
  type StartOutcome,
} from "@/lib/datasetOnboarding/types";
import {
  OnboardingSessionProvider,
  useOnboardingSession,
  useOptionalOnboardingSession,
} from "./OnboardingSessionProvider";

// ---------------------------------------------------------------------------
// Scope, fixtures and a fake start operation
// ---------------------------------------------------------------------------

const IDENTITY = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
};

const OTHER_IDENTITY = {
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
  gatewayOrigin: IDENTITY.gatewayOrigin,
};

const PROCESS = asProcessInstanceId("6a0f1d27-1c2e-4f63-9b55-0a7c3d81e4f2");

const ACCEPTED: StartOutcome = {
  kind: "accepted",
  processInstanceId: PROCESS,
};

const sharing: SharingIntent = {
  visibility: "restricted",
  groups: [{ groupId: "group-a", roles: ["dg_ds-view"] }],
};

const fileAt = (reference: string): RetainedFile => ({
  id: reference,
  name: `${reference}.csv`,
  status: "success",
  stagedPath: reference,
});

const request = (
  files: readonly RetainedFile[] = [fileAt("staged/one.csv")],
): SubmissionRequest => ({
  files,
  metadata: {
    name: "Sensor readings 2026",
    description: "Hourly readings from the pilot network.",
    license: "CC-BY-4.0",
    headline: "Pilot network readings",
    keywords: ["sensors"],
    fieldOfScience: ["Environmental science"],
    datePublished: "2026-09-23",
  },
  sharing,
});

interface FakeStart extends OnboardingStartOperations {
  readonly calls: number[];
  readonly settle: (outcome: StartOutcome) => void;
}

/** A fake start operation with one manually settled pending call at a time. */
const fakeStart = (): FakeStart => {
  const calls: number[] = [];
  let resolveCurrent: ((outcome: StartOutcome) => void) | null = null;
  return {
    calls,
    settle: (outcome) => {
      resolveCurrent?.(outcome);
      resolveCurrent = null;
    },
    start() {
      calls.push(calls.length + 1);
      return new Promise<StartOutcome>((resolve) => {
        resolveCurrent = resolve;
      });
    },
  };
};

const memoryStorage = (): SessionStorageLike => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

// ---------------------------------------------------------------------------
// Harness: two consumers that swap under one provider
// ---------------------------------------------------------------------------

/** Stands in for the submission form. It is the only component that submits. */
const FormConsumer = ({ files }: { files?: readonly RetainedFile[] }) => {
  const session = useOnboardingSession();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          session.submit(request(files));
        }}
      >
        Submit
      </button>
      <p data-testid="form-status">{session.status}</p>
      <p data-testid="form-block">{session.blocked?.kind ?? "none"}</p>
    </div>
  );
};

/** Stands in for the processing view after client-side navigation. */
const ProcessingConsumer = () => {
  const session = useOnboardingSession();
  return (
    <div>
      <p data-testid="processing-status">{session.status}</p>
      <p data-testid="process-id">{session.processInstanceId ?? "none"}</p>
      <p data-testid="sharing">
        {session.sharingIntent === null
          ? "none"
          : `${session.sharingIntent.visibility}:${session.sharingIntent.groups
              .map((group) => group.groupId)
              .join(",")}`}
      </p>
    </div>
  );
};

interface HarnessProps {
  readonly consumer: "form" | "processing";
  readonly identity?: typeof IDENTITY | null;
  readonly operations: OnboardingStartOperations;
  readonly storage?: SessionStorageLike | null;
  readonly files?: readonly RetainedFile[];
}

const Harness = ({
  consumer,
  identity = IDENTITY,
  operations,
  storage = null,
  files,
}: HarnessProps) => (
  <OnboardingSessionProvider
    identity={identity}
    operations={operations}
    storage={storage}
  >
    {consumer === "form" ? (
      <FormConsumer {...(files ? { files } : {})} />
    ) : null}
    {consumer === "processing" ? <ProcessingConsumer /> : null}
  </OnboardingSessionProvider>
);

const clickSubmit = () => {
  act(() => {
    screen.getByRole("button", { name: "Submit" }).click();
  });
};

// ---------------------------------------------------------------------------
// Shape and inertness
// ---------------------------------------------------------------------------

describe("provider shape", () => {
  it("renders its children and no markup of its own", () => {
    const { container } = render(
      <OnboardingSessionProvider
        identity={IDENTITY}
        operations={fakeStart()}
        storage={null}
      >
        <span>child</span>
      </OnboardingSessionProvider>,
    );

    expect(container.innerHTML).toBe("<span>child</span>");
  });

  it("starts nothing and stores nothing until an explicit submission", () => {
    const operations = fakeStart();
    const storage = memoryStorage();

    render(
      <Harness
        consumer="form"
        operations={operations}
        storage={storage}
        files={[fileAt("staged/one.csv")]}
      />,
    );

    expect(operations.calls).toHaveLength(0);
    expect(storage.getItem(SESSION_RECORD_KEY)).toBeNull();
    expect(screen.getByTestId("form-status")).toHaveTextContent("idle");
  });

  it("exposes no session outside a provider", () => {
    const Optional = () => (
      <p data-testid="optional">
        {useOptionalOnboardingSession() === null ? "absent" : "present"}
      </p>
    );
    const Required = () => {
      useOnboardingSession();
      return null;
    };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Optional />);
    expect(screen.getByTestId("optional")).toHaveTextContent("absent");
    expect(() => render(<Required />)).toThrow(
      /must be used within an OnboardingSessionProvider/,
    );

    errors.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Ownership across a consumer change
// ---------------------------------------------------------------------------

describe("ownership across consumers", () => {
  it("keeps one attempt when the form hands over to the processing view", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { rerender } = render(
      <Harness consumer="form" operations={operations} storage={storage} />,
    );

    clickSubmit();
    expect(screen.getByTestId("form-status")).toHaveTextContent("starting");

    // Client-side navigation: the form unmounts, the processing view mounts,
    // and the provider above both of them stays put.
    rerender(
      <Harness
        consumer="processing"
        operations={operations}
        storage={storage}
      />,
    );
    expect(screen.getByTestId("processing-status")).toHaveTextContent(
      "starting",
    );

    await act(async () => {
      operations.settle(ACCEPTED);
    });

    expect(screen.getByTestId("processing-status")).toHaveTextContent(
      "accepted",
    );
    expect(screen.getByTestId("process-id")).toHaveTextContent(PROCESS);
    // The sharing selection survived the handover, in memory, unconfirmed.
    expect(screen.getByTestId("sharing")).toHaveTextContent(
      "restricted:group-a",
    );
    // One start for one submission, across the whole transition.
    expect(operations.calls).toHaveLength(1);
  });

  it("refuses a repeat submission after the consumer changes back", async () => {
    const operations = fakeStart();
    const { rerender } = render(
      <Harness consumer="form" operations={operations} />,
    );

    clickSubmit();
    await act(async () => {
      operations.settle(ACCEPTED);
    });

    rerender(<Harness consumer="processing" operations={operations} />);
    rerender(<Harness consumer="form" operations={operations} />);

    clickSubmit();

    expect(operations.calls).toHaveLength(1);
    expect(screen.getByTestId("form-block")).toHaveTextContent(
      "attempt-accepted",
    );
  });
});

// ---------------------------------------------------------------------------
// Identity isolation and remount
// ---------------------------------------------------------------------------

describe("identity and remount", () => {
  it("shows no earlier identity's process after the principal changes", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { rerender } = render(
      <Harness consumer="form" operations={operations} storage={storage} />,
    );

    clickSubmit();
    await act(async () => {
      operations.settle(ACCEPTED);
    });
    rerender(
      <Harness
        consumer="processing"
        operations={operations}
        storage={storage}
      />,
    );
    expect(screen.getByTestId("process-id")).toHaveTextContent(PROCESS);

    rerender(
      <Harness
        consumer="processing"
        identity={OTHER_IDENTITY}
        operations={operations}
        storage={storage}
      />,
    );

    expect(screen.getByTestId("processing-status")).toHaveTextContent("idle");
    expect(screen.getByTestId("process-id")).toHaveTextContent("none");
    expect(screen.getByTestId("sharing")).toHaveTextContent("none");
  });

  it("is inert on a remount, and claims no deduplication beyond it", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const first = render(
      <Harness consumer="form" operations={operations} storage={storage} />,
    );

    clickSubmit();
    await act(async () => {
      operations.settle(ACCEPTED);
    });
    expect(operations.calls).toHaveLength(1);
    first.unmount();

    // A fresh mount is a fresh owner. It starts nothing by itself, does not
    // read the reference the previous owner stored, and — deliberately — does
    // not pretend to remember that these uploads were already submitted. This
    // owner-scoped guard is not a cross-tab or cross-session claim.
    render(
      <Harness consumer="form" operations={operations} storage={storage} />,
    );
    expect(operations.calls).toHaveLength(1);
    expect(screen.getByTestId("form-status")).toHaveTextContent("idle");

    clickSubmit();

    expect(operations.calls).toHaveLength(2);
  });
});
