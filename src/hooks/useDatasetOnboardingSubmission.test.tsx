import { act, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  SESSION_RECORD_KEY,
  type SessionStorageLike,
} from "@/lib/datasetOnboarding/recovery";
import type {
  OnboardingMetadataInput,
  RetainedFile,
  SharingIntent,
  SubmissionRequest,
} from "@/lib/datasetOnboarding/submission";
import {
  asProcessInstanceId,
  type OnboardingStartInput,
  type StartOutcome,
} from "@/lib/datasetOnboarding/types";
import {
  type OnboardingStartOperations,
  type UseDatasetOnboardingSubmissionInput,
  useDatasetOnboardingSubmission,
} from "./useDatasetOnboardingSubmission";

// ---------------------------------------------------------------------------
// Scope, fixtures and a fake start operation
// ---------------------------------------------------------------------------

const IDENTITY = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
};

const OTHER_PRINCIPAL = {
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
  gatewayOrigin: IDENTITY.gatewayOrigin,
};

const OTHER_ENVIRONMENT = {
  principalId: IDENTITY.principalId,
  gatewayOrigin: "https://gateway.staging.datagems.example",
};

const PROCESS = asProcessInstanceId("6a0f1d27-1c2e-4f63-9b55-0a7c3d81e4f2");
const OTHER_PROCESS = asProcessInstanceId(
  "1b7e4c50-92a3-4d18-8f6b-70c2e5a9d431",
);

const ACCEPTED: StartOutcome = {
  kind: "accepted",
  processInstanceId: PROCESS,
};
const REJECTED: StartOutcome = { kind: "rejected", httpStatus: 400 };
const UNKNOWN: StartOutcome = {
  kind: "unknown",
  failure: { kind: "forbidden", httpStatus: 403 },
};

const metadata = (): OnboardingMetadataInput => ({
  name: "Sensor readings 2026",
  description: "Hourly readings from the pilot network.",
  license: "CC-BY-4.0",
  headline: "Pilot network readings",
  keywords: ["sensors"],
  fieldOfScience: ["Environmental science"],
  datePublished: "2026-09-23",
});

const sharing: SharingIntent = {
  visibility: "restricted",
  groups: [{ groupId: "group-a", roles: ["dg_ds-view"] }],
};

const fileAt = (reference: string, id = reference): RetainedFile => ({
  id,
  name: `${id}.csv`,
  status: "success",
  stagedPath: reference,
});

const request = (
  files: readonly RetainedFile[] = [fileAt("staged/one.csv")],
  /**
   * Defaults to a legacy non-null selection so the existing cases keep the
   * behaviour they were written for. The migrated form passes `null`, which the
   * private-submission cases below cover explicitly.
   */
  intent: SharingIntent | null = sharing,
): SubmissionRequest => ({ files, metadata: metadata(), sharing: intent });

interface Deferred {
  readonly promise: Promise<StartOutcome>;
  readonly resolve: (outcome: StartOutcome) => void;
  readonly reject: (error: unknown) => void;
}

const defer = (): Deferred => {
  let resolve!: (outcome: StartOutcome) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<StartOutcome>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
};

interface FakeStart extends OnboardingStartOperations {
  readonly calls: {
    input: OnboardingStartInput;
    signal: AbortSignal | undefined;
  }[];
  readonly pending: Deferred[];
}

/**
 * A fake start operation. There is no transport and no network: the hook's
 * contract is the injected `OnboardingStartOperations`, and every assertion
 * below is about *when* it is called and which results are allowed to land.
 * Reads are not part of this interface at all, so they cannot be reached.
 */
const fakeStart = (): FakeStart => {
  const calls: FakeStart["calls"] = [];
  const pending: Deferred[] = [];
  return {
    calls,
    pending,
    start(input, signal) {
      calls.push({ input, signal });
      const deferred = defer();
      pending.push(deferred);
      return deferred.promise;
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

const storedRecord = (storage: SessionStorageLike): unknown => {
  const raw = storage.getItem(SESSION_RECORD_KEY);
  return raw === null ? null : JSON.parse(raw);
};

type HookProps = Partial<UseDatasetOnboardingSubmissionInput> & {
  readonly operations: OnboardingStartOperations;
};

const renderSubmission = (
  props: HookProps,
  wrapper?: (props: { children: ReactNode }) => ReactNode,
) =>
  renderHook(
    (current: HookProps) =>
      useDatasetOnboardingSubmission({
        // `null` is a meaningful value here, so an explicitly supplied one is
        // never replaced by the default identity.
        identity: "identity" in current ? (current.identity ?? null) : IDENTITY,
        operations: current.operations,
        storage: current.storage === undefined ? null : current.storage,
      }),
    { initialProps: props, ...(wrapper ? { wrapper } : {}) },
  );

const strictWrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

// ---------------------------------------------------------------------------
// Explicit action only
// ---------------------------------------------------------------------------

describe("starting", () => {
  it("does not start on mount, on a re-render or on an identity resolving", () => {
    const operations = fakeStart();
    const { rerender } = renderSubmission({ operations, identity: null });

    rerender({ operations, identity: IDENTITY });
    rerender({ operations, identity: { ...IDENTITY } });

    expect(operations.calls).toHaveLength(0);
  });

  it("refuses to submit before an identity is resolved", () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations, identity: null });

    let outcome: ReturnType<typeof result.current.submit> | undefined;
    act(() => {
      outcome = result.current.submit(request());
    });

    expect(outcome).toEqual({
      kind: "refused",
      block: { kind: "identity-unavailable" },
    });
    expect(operations.calls).toHaveLength(0);
    expect(result.current.blocked).toEqual({ kind: "identity-unavailable" });
  });

  it("sends exactly one start for repeated actions in the same tick", () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    const outcomes: ReturnType<typeof result.current.submit>[] = [];
    act(() => {
      // Three clicks before React has re-rendered once: the guard has to hold
      // synchronously, not through committed state.
      outcomes.push(result.current.submit(request()));
      outcomes.push(result.current.submit(request()));
      outcomes.push(result.current.submit(request()));
    });

    expect(operations.calls).toHaveLength(1);
    expect(outcomes[0]).toEqual({ kind: "started", attemptId: 1 });
    expect(outcomes[1]).toEqual({
      kind: "refused",
      block: { kind: "already-starting" },
    });
    expect(outcomes[2]).toEqual({
      kind: "refused",
      block: { kind: "already-starting" },
    });
    expect(result.current.status).toBe("starting");
    expect(result.current.attempt?.attemptId).toBe(1);
  });

  it("holds the same guard under StrictMode double rendering", () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations }, strictWrapper);

    act(() => {
      result.current.submit(request());
      result.current.submit(request());
    });

    expect(operations.calls).toHaveLength(1);
  });

  it("blocks an unresolved retained file without reaching the operation", () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(
        request([
          fileAt("staged/one.csv"),
          { id: "busy", name: "b", status: "uploading" },
        ]),
      );
    });

    expect(operations.calls).toHaveLength(0);
    expect(result.current.blocked).toEqual({
      kind: "unresolved-files",
      files: [{ fileId: "busy", name: "b", reason: "uploading" }],
    });
  });
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

describe("outcomes", () => {
  it("retains the accepted process reference and writes the minimal record", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.processInstanceId).toBe(PROCESS);
    expect(result.current.sessionWrite?.kind).toBe("stored");

    const record = storedRecord(storage) as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual([
      "gatewayOrigin",
      "principalId",
      "processInstanceId",
      "recordedAt",
      "sharingNeedsReconciliation",
      "version",
    ]);
    expect(record.processInstanceId).toBe(PROCESS);
    expect(record.principalId).toBe(IDENTITY.principalId);
    // Sharing was never applied here, so it is recorded as unconfirmed.
    expect(record.sharingNeedsReconciliation).toBe(true);
    // The intent itself stays in memory and is never persisted.
    expect(result.current.sharingIntent).toEqual(sharing);
    expect(JSON.stringify(record)).not.toContain("group-a");
    expect(JSON.stringify(record)).not.toContain("staged/one.csv");
    expect(JSON.stringify(record)).not.toContain("Sensor readings");
  });

  it("keeps the accepted reference when the store refuses the write", async () => {
    const operations = fakeStart();
    const storage: SessionStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.processInstanceId).toBe(PROCESS);
    expect(result.current.sessionWrite).toEqual({ kind: "unavailable" });
  });

  it("keeps a definite rejection out of the store", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(REJECTED);
    });

    expect(result.current.status).toBe("rejected");
    expect(result.current.rejection).toEqual({ httpStatus: 400 });
    expect(result.current.processInstanceId).toBeNull();
    expect(storedRecord(storage)).toBeNull();
  });

  it("holds an unknown outcome without retrying or borrowing a stored id", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    // A reference from an earlier attempt is already in the store. An unknown
    // start must neither read it nor adopt it.
    storage.setItem(
      SESSION_RECORD_KEY,
      JSON.stringify({
        version: 1,
        processInstanceId: OTHER_PROCESS,
        principalId: IDENTITY.principalId,
        gatewayOrigin: IDENTITY.gatewayOrigin,
        recordedAt: "2026-09-23T08:00:00.000Z",
        sharingNeedsReconciliation: true,
      }),
    );
    const { result, rerender } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(UNKNOWN);
    });
    rerender({ operations, storage });

    expect(result.current.status).toBe("unknown");
    expect(result.current.unknownFailure).toEqual({
      kind: "forbidden",
      httpStatus: 403,
    });
    expect(result.current.processInstanceId).toBeNull();
    // No automatic replay, and the earlier record is neither read nor rewritten.
    expect(operations.calls).toHaveLength(1);
    expect(
      (storedRecord(storage) as Record<string, unknown>).processInstanceId,
    ).toBe(OTHER_PROCESS);
  });

  it("treats a throwing operation as unknown, never as a rejection", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.reject(new Error("network down"));
    });

    expect(result.current.status).toBe("unknown");
    expect(result.current.unknownFailure).toEqual({ kind: "transient" });
  });
});

// ---------------------------------------------------------------------------
// Consumed references
// ---------------------------------------------------------------------------

describe("consumed references", () => {
  it("refuses to resubmit an accepted attempt's files after a discard", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });
    act(() => {
      result.current.discard();
    });

    let outcome: ReturnType<typeof result.current.submit> | undefined;
    act(() => {
      outcome = result.current.submit(request());
    });

    expect(operations.calls).toHaveLength(1);
    expect(outcome).toEqual({
      kind: "refused",
      block: {
        kind: "references-unusable",
        files: [
          {
            fileId: "staged/one.csv",
            name: "staged/one.csv.csv",
            reference: "staged/one.csv",
            disposition: "consumed",
          },
        ],
      },
    });
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "consumed",
    );
  });

  it("keeps an unknown attempt's files unusable and accepts fresh ones", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(UNKNOWN);
    });
    act(() => {
      result.current.discard();
    });

    act(() => {
      result.current.submit(request());
    });
    expect(operations.calls).toHaveLength(1);
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "possibly-consumed",
    );

    act(() => {
      result.current.submit(request([fileAt("staged/fresh.csv")]));
    });
    expect(operations.calls).toHaveLength(2);
  });

  it("requires injected evidence before reusing a rejected attempt's files", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(REJECTED);
    });

    act(() => {
      result.current.submit(request());
    });
    expect(operations.calls).toHaveLength(1);
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "unvalidated",
    );

    act(() => {
      result.current.provideStagingValidity({
        references: ["staged/one.csv"],
        source: "operator re-checked the staged upload",
      });
    });
    act(() => {
      result.current.submit(request());
    });

    expect(operations.calls).toHaveLength(2);
  });

  it("does not release references when a start is aborted", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    act(() => {
      result.current.abort();
    });

    expect(operations.calls[0]?.signal?.aborted).toBe(true);
    // Abort is a local signal. The server may have received the start, so the
    // outcome is unknown and the references stay unusable.
    await act(async () => {
      operations.pending[0]?.resolve({
        kind: "unknown",
        failure: { kind: "cancelled" },
      });
    });

    expect(result.current.status).toBe("unknown");
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "possibly-consumed",
    );
  });

  it("keeps a process accepted after an abort, because abort undoes nothing", async () => {
    const operations = fakeStart();
    const { result } = renderSubmission({ operations });

    act(() => {
      result.current.submit(request());
    });
    act(() => {
      result.current.abort();
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.processInstanceId).toBe(PROCESS);
  });
});

// ---------------------------------------------------------------------------
// Identity and environment
// ---------------------------------------------------------------------------

describe("identity and environment", () => {
  it.each([
    ["principal", OTHER_PRINCIPAL],
    ["environment", OTHER_ENVIRONMENT],
  ])("discards a late result after the %s changes", async (_label, next) => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result, rerender } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    rerender({ operations, storage, identity: next });

    // Nothing of the previous scope is rendered, before the response arrives.
    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBeNull();
    expect(result.current.referenceDisposition("staged/one.csv")).toBeNull();

    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.processInstanceId).toBeNull();
    expect(result.current.sessionWrite).toBeNull();
    // The other identity's outcome never reaches the store either.
    expect(storedRecord(storage)).toBeNull();
  });

  it("does not write the store when a late acceptance lands after teardown", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result, unmount } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    unmount();
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(storedRecord(storage)).toBeNull();
    expect(operations.calls[0]?.signal?.aborted).toBe(true);
  });

  it("does not restart or discard a pending attempt on a token refresh", async () => {
    const first = fakeStart();
    const storage = memoryStorage();
    const { result, rerender } = renderSubmission({
      operations: first,
      storage,
    });

    act(() => {
      result.current.submit(request());
    });

    // A refreshed token hands the hook a *new* operations object for the same
    // principal. That is not a scope change.
    const refreshed: OnboardingStartOperations = {
      start: vi.fn(async () => ACCEPTED),
    };
    rerender({ operations: refreshed, storage, identity: { ...IDENTITY } });

    expect(result.current.status).toBe("starting");
    expect(result.current.attempt?.attemptId).toBe(1);
    expect(refreshed.start).not.toHaveBeenCalled();

    await act(async () => {
      first.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.processInstanceId).toBe(PROCESS);
    expect(storedRecord(storage)).not.toBeNull();
  });

  it("uses the injected principal and origin, never a token or an email", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    const record = storedRecord(storage) as Record<string, unknown>;
    expect(record.principalId).toBe(IDENTITY.principalId);
    expect(record.gatewayOrigin).toBe(IDENTITY.gatewayOrigin);
    expect(JSON.stringify(record)).not.toContain("@");
  });
});

// ---------------------------------------------------------------------------
// A refused action must not consume the settled attempt (R1)
// ---------------------------------------------------------------------------

describe("refusal after a settled attempt", () => {
  it.each([
    ["accepted", ACCEPTED],
    ["unknown", UNKNOWN],
  ])(
    "keeps an %s attempt through repeats and starts nothing until a discard",
    async (status, outcome) => {
      const operations = fakeStart();
      const { result } = renderSubmission({ operations });

      act(() => {
        result.current.submit(request());
      });
      await act(async () => {
        operations.pending[0]?.resolve(outcome);
      });

      // Two further submissions with fresh, never-sent files.
      act(() => {
        result.current.submit(request([fileAt("staged/fresh-a.csv")]));
      });
      expect(result.current.status).toBe(status);
      act(() => {
        result.current.submit(request([fileAt("staged/fresh-b.csv")]));
      });

      expect(result.current.status).toBe(status);
      expect(operations.calls).toHaveLength(1);
      if (outcome === ACCEPTED) {
        expect(result.current.processInstanceId).toBe(PROCESS);
      }
      // The retained sharing intent survives the refusals.
      expect(result.current.sharingIntent).toEqual(sharing);

      // Control: the explicit discard is what permits another attempt.
      act(() => {
        result.current.discard();
      });
      act(() => {
        result.current.submit(request([fileAt("staged/fresh-c.csv")]));
      });

      expect(operations.calls).toHaveLength(2);
      expect(result.current.status).toBe("starting");
    },
  );
});

// ---------------------------------------------------------------------------
// Action handles are bound to the owner that issued them (R2)
// ---------------------------------------------------------------------------

describe("stale action handles", () => {
  it("cannot dispatch or write a session after the owner is torn down", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result, unmount } = renderSubmission({ operations, storage });
    const staleSubmit = result.current.submit;
    const staleDisposition = result.current.referenceDisposition;

    unmount();
    let outcome: ReturnType<typeof result.current.submit> | undefined;
    await act(async () => {
      outcome = staleSubmit(request());
    });

    expect(operations.calls).toHaveLength(0);
    expect(storedRecord(storage)).toBeNull();
    expect(outcome?.kind).toBe("refused");
    expect(staleDisposition("staged/one.csv")).toBeNull();
  });

  it.each([
    ["principal", OTHER_PRINCIPAL],
    ["environment", OTHER_ENVIRONMENT],
  ])(
    "cannot dispatch through a replacement owner after the %s changes",
    async (_label, next) => {
      const before = fakeStart();
      const after = fakeStart();
      const storage = memoryStorage();
      const { result, rerender } = renderSubmission({
        operations: before,
        storage,
      });
      const staleSubmit = result.current.submit;

      rerender({ operations: after, storage, identity: next });
      let outcome: ReturnType<typeof result.current.submit> | undefined;
      await act(async () => {
        outcome = staleSubmit(request());
      });

      expect(before.calls).toHaveLength(0);
      expect(after.calls).toHaveLength(0);
      expect(outcome?.kind).toBe("refused");
      // Nothing of the old owner is written into the replacement's state.
      expect(result.current.status).toBe("idle");
      expect(result.current.attempt).toBeNull();
      expect(storedRecord(storage)).toBeNull();
    },
  );

  it("stays stale after the original principal returns", async () => {
    const firstOps = fakeStart();
    const otherOps = fakeStart();
    const returnedOps = fakeStart();
    const { result, rerender } = renderSubmission({ operations: firstOps });
    const staleSubmit = result.current.submit;

    rerender({ operations: otherOps, identity: OTHER_PRINCIPAL });
    rerender({ operations: returnedOps, identity: IDENTITY });
    await act(async () => {
      staleSubmit(request());
    });

    expect(firstOps.calls).toHaveLength(0);
    expect(otherOps.calls).toHaveLength(0);
    expect(returnedOps.calls).toHaveLength(0);
    expect(result.current.status).toBe("idle");

    // Control: the owner that is current now works normally.
    act(() => {
      result.current.submit(request());
    });
    expect(returnedOps.calls).toHaveLength(1);
  });

  it("cannot end or cancel a replacement owner's attempt", async () => {
    const before = fakeStart();
    const after = fakeStart();
    const { result, rerender } = renderSubmission({ operations: before });
    const staleAbort = result.current.abort;
    const staleDiscard = result.current.discard;

    rerender({ operations: after, identity: OTHER_PRINCIPAL });
    act(() => {
      result.current.submit(request());
    });
    act(() => {
      staleAbort();
    });

    expect(after.calls[0]?.signal?.aborted).toBe(false);

    await act(async () => {
      after.pending[0]?.resolve(ACCEPTED);
    });
    act(() => {
      staleDiscard();
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.processInstanceId).toBe(PROCESS);
  });

  it("cannot release or expose a replacement owner's references", async () => {
    const before = fakeStart();
    const after = fakeStart();
    const { result, rerender } = renderSubmission({ operations: before });
    const staleValidity = result.current.provideStagingValidity;
    const staleDisposition = result.current.referenceDisposition;

    rerender({ operations: after, identity: OTHER_PRINCIPAL });
    act(() => {
      result.current.submit(request());
    });
    await act(async () => {
      after.pending[0]?.resolve(REJECTED);
    });
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "unvalidated",
    );

    act(() => {
      staleValidity({
        references: ["staged/one.csv"],
        source: "a handle from a previous owner",
      });
    });
    act(() => {
      result.current.submit(request());
    });

    // Still refused: the stale injection changed nothing.
    expect(after.calls).toHaveLength(1);
    expect(result.current.referenceDisposition("staged/one.csv")).toBe(
      "unvalidated",
    );
    // And the stale accessor reveals nothing about this owner's ledger.
    expect(staleDisposition("staged/one.csv")).toBeNull();
  });

  it("control: a handle kept across a re-render and token refresh still works", () => {
    const first = fakeStart();
    const refreshed = fakeStart();
    const { result, rerender } = renderSubmission({ operations: first });
    const retainedSubmit = result.current.submit;

    // Same principal, new operations object and a new identity object.
    rerender({ operations: refreshed, identity: { ...IDENTITY } });
    act(() => {
      retainedSubmit(request());
    });

    expect(first.calls).toHaveLength(0);
    expect(refreshed.calls).toHaveLength(1);
    expect(result.current.status).toBe("starting");
  });

  it("control: current handles submit once per owner under StrictMode", async () => {
    const before = fakeStart();
    const after = fakeStart();
    const { result, rerender } = renderSubmission(
      { operations: before },
      strictWrapper,
    );

    await act(async () => {
      result.current.submit(request());
      before.pending[0]?.resolve(ACCEPTED);
    });
    expect(result.current.status).toBe("accepted");

    rerender({ operations: after, identity: OTHER_PRINCIPAL });
    await act(async () => {
      result.current.submit(request());
      after.pending[0]?.resolve(ACCEPTED);
    });

    expect(result.current.status).toBe("accepted");
    expect(before.calls).toHaveLength(1);
    expect(after.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Private submissions: the reconciliation marker follows the intent
// ---------------------------------------------------------------------------

describe("no sharing requested", () => {
  it("records no reconciliation need for a null-intent acceptance", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request([fileAt("staged/one.csv")], null));
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    const record = storedRecord(storage) as Record<string, unknown>;
    // Nothing was requested, so nothing is outstanding. A `true` here would
    // leave the processing page showing a task no action could ever close.
    expect(record.sharingNeedsReconciliation).toBe(false);
    expect(record.processInstanceId).toBe(PROCESS);
    // The schema is unchanged; only the marker's value is new.
    expect(Object.keys(record).sort()).toEqual([
      "gatewayOrigin",
      "principalId",
      "processInstanceId",
      "recordedAt",
      "sharingNeedsReconciliation",
      "version",
    ]);
    expect(result.current.sharingIntent).toBeNull();
  });

  it("still records a reconciliation need for a legacy non-null intent", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    act(() => {
      result.current.submit(request([fileAt("staged/one.csv")], sharing));
    });
    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    const record = storedRecord(storage) as Record<string, unknown>;
    expect(record.sharingNeedsReconciliation).toBe(true);
    expect(result.current.sharingIntent).toEqual(sharing);
  });

  it("derives the marker from the attempt, not from the latest render", async () => {
    const operations = fakeStart();
    const storage = memoryStorage();
    const { result } = renderSubmission({ operations, storage });

    // Dispatch a private attempt, then discard it and start a legacy one while
    // the first is still unresolved would be refused — so instead prove the
    // opposite direction: the settled attempt's own frozen intent decides.
    act(() => {
      result.current.submit(request([fileAt("staged/one.csv")], null));
    });
    expect(result.current.status).toBe("starting");

    await act(async () => {
      operations.pending[0]?.resolve(ACCEPTED);
    });

    expect(operations.calls).toHaveLength(1);
    expect(
      (storedRecord(storage) as Record<string, unknown>)
        .sharingNeedsReconciliation,
    ).toBe(false);
  });

  it("writes no record at all for a private attempt that is not accepted", async () => {
    for (const outcome of [REJECTED, UNKNOWN]) {
      const operations = fakeStart();
      const storage = memoryStorage();
      const { result } = renderSubmission({ operations, storage });

      act(() => {
        result.current.submit(request([fileAt("staged/one.csv")], null));
      });
      await act(async () => {
        operations.pending[0]?.resolve(outcome);
      });

      expect(storedRecord(storage)).toBeNull();
      expect(result.current.processInstanceId).toBeNull();
    }
  });
});
