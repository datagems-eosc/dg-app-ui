/**
 * Dataset onboarding — pure submission state.
 *
 * This module owns the deterministic half of "submit once": which retained
 * files may be submitted at all, what exactly is frozen into one attempt, how
 * an attempt settles, and what may never be submitted again afterwards. It is
 * a leaf like the rest of this directory — no React, no HTTP, no auth, no
 * storage, no timers. Lifecycle belongs to
 * `src/hooks/useDatasetOnboardingSubmission.ts`; ownership across a consumer
 * change belongs to `src/components/DatasetOnboarding/OnboardingSessionProvider.tsx`.
 *
 * Deliberately absent, and not an oversight:
 *
 *  - no transport and no retry. Nothing here can send, resend or schedule a
 *    request; `startInput` is data, and the caller performs exactly one start;
 *  - no grant, visibility or collection policy. Sharing intent is `null` for
 *    every submission this UI now makes (revision 5: onboarding creates
 *    privately, sharing is a later and separate action). A non-null intent is
 *    still accepted for an explicitly evidenced earlier context and is carried
 *    verbatim as that contributor's *selection* — never applied, mapped to a
 *    backend role or read back as access;
 *  - no title lookup, dataset search or name matching. An unknown outcome
 *    stays unknown;
 *  - no claim about the server. Validation here is UI submission integrity: it
 *    establishes neither staging validity, staging lifetime, server-side
 *    deduplication nor domain-specific multi-file completeness.
 */

import {
  DATA_LOCATION_KIND,
  type GatewayFailure,
  type OnboardingStartInput,
  type ProcessInstanceId,
  type StartOutcome,
} from "./types";

// ---------------------------------------------------------------------------
// Caller-supplied shapes
// ---------------------------------------------------------------------------

/**
 * The retained file as the existing uploader represents it, narrowed to the
 * three properties submission integrity depends on. It is declared
 * structurally rather than imported so this leaf keeps no dependency on a
 * component; `UploadedFile` from `components/ui/datasets/DatasetUpload.tsx`
 * satisfies it as-is.
 *
 * `stagedPath` is the per-file upload reference. It is **not**
 * `DataLocationKind.Staged`: that kind is the Gateway's single-directory
 * contract, which `OnboardValidator` requires to be the only location in a
 * request. The existing uploader produces one reference per file and the
 * existing form sends each as `kind: File`, so that is what is preserved here
 * — N file locations, never one staged directory.
 */
export interface RetainedFile {
  readonly id: string;
  readonly name: string;
  readonly status: "uploading" | "success" | "error";
  readonly stagedPath?: string;
}

/** The frozen metadata half of a start. File locations are derived, not passed. */
export type OnboardingMetadataInput = Omit<
  OnboardingStartInput,
  "dataLocations"
>;

export type SharingVisibility = "public" | "restricted";

/**
 * One selected recipient group and the roles the contributor chose for it.
 *
 * Roles travel as the caller supplied them. This module neither maps a UI
 * permission to a backend role nor asserts that a listed group is grantable:
 * both are the confirmed-grant-contract work that G2 still blocks.
 */
export interface SharingGroupIntent {
  readonly groupId: string;
  readonly roles: readonly string[];
}

/**
 * Retained sharing *intent*. It records what the contributor asked for, never
 * what is true: no grant has been applied, no visibility has been established,
 * and the absence of a grant call proves neither public nor private access.
 */
export interface SharingIntent {
  readonly visibility: SharingVisibility;
  readonly groups: readonly SharingGroupIntent[];
}

export interface SubmissionRequest {
  readonly files: readonly RetainedFile[];
  readonly metadata: OnboardingMetadataInput;
  /**
   * `null` means *this flow asked for nothing*, which is what the migrated
   * form always passes. It is deliberately not a fabricated `Restricted`
   * selection: inventing one would claim a choice the contributor never made
   * and would leave a reconciliation task behind that nothing can ever close.
   *
   * A non-null intent remains supported for an explicitly evidenced earlier
   * context. Nothing in this module applies either one.
   */
  readonly sharing: SharingIntent | null;
}

// ---------------------------------------------------------------------------
// Validation outcome
// ---------------------------------------------------------------------------

export type UnresolvedFileReason =
  /** Upload has not finished. */
  | "uploading"
  /** Upload reported a failure. */
  | "failed"
  /** Upload reported success but supplied no reference. */
  | "missing-reference"
  /** A reference that cannot be sent as-is (blank, or carrying control bytes). */
  | "invalid-reference"
  /** Two retained files carry the same reference. */
  | "duplicate-reference";

export interface UnresolvedFile {
  readonly fileId: string;
  readonly name: string;
  readonly reason: UnresolvedFileReason;
}

export interface UnusableReference {
  readonly fileId: string;
  readonly name: string;
  readonly reference: string;
  readonly disposition: ReferenceDisposition;
}

/** Why a submission was refused. Every case names what the user must resolve. */
export type SubmissionBlock =
  /** No identity is resolved, so nothing may be attributed or attempted. */
  | { readonly kind: "identity-unavailable" }
  | { readonly kind: "no-files" }
  | {
      readonly kind: "unresolved-files";
      readonly files: readonly UnresolvedFile[];
    }
  | {
      readonly kind: "references-unusable";
      readonly files: readonly UnusableReference[];
    }
  /** A start is in flight for this owner. The repeat is refused, not queued. */
  | { readonly kind: "already-starting" }
  /** This owner already holds an accepted process; discard it deliberately. */
  | { readonly kind: "attempt-accepted" }
  /** The previous outcome is unknown. Only an explicit discard moves on. */
  | { readonly kind: "attempt-unknown" }
  /**
   * The owner that issued this action is no longer the active one — it was
   * torn down, or its identity/environment changed. Set by the lifecycle
   * owner, never by a transition here.
   */
  | { readonly kind: "owner-inactive" };

// ---------------------------------------------------------------------------
// Reference disposition
// ---------------------------------------------------------------------------

/**
 * What is known about an upload reference this owner has already sent.
 *
 * There is no "reusable" member on purpose: a reference this owner never sent
 * is simply absent from the ledger. Once sent, it can only become *less*
 * restricted through explicit evidence, never through time, a reset or a later
 * process failure.
 */
export type ReferenceDisposition =
  /** An accepted start consumed it. Permanent for this owner. */
  | "consumed"
  /** A dispatched start whose outcome is not known. Treated as consumed. */
  | "possibly-consumed"
  /**
   * A definite pre-start rejection returned it unconsumed — but a rejection
   * proves only that *this* request was refused, not that the staged upload is
   * still valid and still there. Reuse needs renewed evidence.
   */
  | "unvalidated";

export interface ReferenceRecord {
  readonly reference: string;
  readonly disposition: ReferenceDisposition;
}

/**
 * Evidence that named references are still valid and unconsumed, established
 * outside this module by an authorized check.
 *
 * It is an *input*, never something this module produces: no Gateway call is
 * fabricated here, and nothing infers renewed validity from elapsed time, a
 * rejection code or a re-render. It can only lift `unvalidated`; a consumed or
 * possibly-consumed reference is not revivable by any evidence.
 */
export interface StagingValidityEvidence {
  readonly references: readonly string[];
  /** Where the evidence came from. Recorded for diagnosis; nothing branches on it. */
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Attempt and state
// ---------------------------------------------------------------------------

/**
 * Everything one start sends, deeply frozen and detached from the caller's
 * objects. The caller may keep editing the form afterwards: this snapshot
 * cannot change, so what is retried against, reported and compared is what was
 * actually submitted.
 */
export interface FrozenSubmission {
  readonly startInput: OnboardingStartInput;
  /** `null` when this flow requested no sharing. See `SubmissionRequest`. */
  readonly sharing: SharingIntent | null;
  /** The references this attempt sends, in file order. */
  readonly references: readonly string[];
}

export interface SubmissionAttempt {
  /** Monotonic within one owner. Identifies which result may land. */
  readonly attemptId: number;
  readonly submission: FrozenSubmission;
}

/**
 * What the *attempt* is doing. A refused action is deliberately not a member:
 * refusing one submission must never displace an accepted process reference,
 * an unknown outcome, a running attempt or a definite rejection. Refusals are
 * reported through `blocked` instead.
 */
export type SubmissionStatus =
  | "idle"
  | "starting"
  | "accepted"
  | "rejected"
  | "unknown";

export interface SubmissionState {
  readonly status: SubmissionStatus;
  /** The attempt in flight, or the last one that settled. */
  readonly attempt: SubmissionAttempt | null;
  /** Set only when `status` is `accepted`. */
  readonly processInstanceId: ProcessInstanceId | null;
  /** Set only when `status` is `rejected`. A definite pre-start refusal. */
  readonly rejection: { readonly httpStatus: number } | null;
  /** Set only when `status` is `unknown`. Never a reason to resend. */
  readonly unknownFailure: GatewayFailure | null;
  /**
   * Why the last action was refused, independently of `status`. Cleared when a
   * submission is accepted for dispatch, when an attempt settles and on an
   * explicit discard.
   */
  readonly blocked: SubmissionBlock | null;
  /** Every reference this owner has sent. Survives discard; never cleared. */
  readonly references: readonly ReferenceRecord[];
}

export const initialSubmissionState = (): SubmissionState => ({
  status: "idle",
  attempt: null,
  processInstanceId: null,
  rejection: null,
  unknownFailure: null,
  blocked: null,
  references: [],
});

// ---------------------------------------------------------------------------
// Freezing
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Deep-copies arrays and plain objects, then freezes every level.
 *
 * Copying first is the point: freezing the caller's own object would make
 * *their* form data immutable, and keeping a reference to it would let a later
 * edit rewrite what we believe we submitted. Anything that is neither an array
 * nor a plain object is a primitive here and is carried as-is.
 */
const freezeDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeDeep)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, property] of Object.entries(value)) {
      copy[key] = freezeDeep(property);
    }
    return Object.freeze(copy) as T;
  }
  return value;
};

// ---------------------------------------------------------------------------
// File validation (architect ruling D7, 23 September)
// ---------------------------------------------------------------------------

/**
 * Written as a scan rather than a character-class regex, as in the route
 * controller, so the control characters being looked for are not control
 * characters in this source.
 */
const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

const unresolvedReason = (file: RetainedFile): UnresolvedFileReason | null => {
  if (file.status === "uploading") return "uploading";
  if (file.status === "error") return "failed";
  const reference = file.stagedPath;
  if (reference === undefined || reference === null) return "missing-reference";
  if (reference.trim() === "" || hasControlCharacter(reference)) {
    return "invalid-reference";
  }
  return null;
};

/**
 * Checks every retained file and reports all of them, in file order.
 *
 * Two rules the accepted policy is explicit about: at least one retained file
 * is required, and a file that has not finished uploading cleanly **blocks**
 * the submission. Silently excluding it — which the existing form does — is
 * what this replaces, because the contributor would otherwise publish a
 * dataset missing files they believed they had attached.
 *
 * A duplicate reference is refused for the same reason. Deduplicating would be
 * a silent exclusion, and sending the same staged upload as two data locations
 * is very unlikely to be what was meant; both retained files are named so the
 * contributor decides.
 */
export const findUnresolvedFiles = (
  files: readonly RetainedFile[],
): readonly UnresolvedFile[] => {
  const unresolved: UnresolvedFile[] = [];
  const seen = new Map<string, number>();

  for (const file of files) {
    const reason = unresolvedReason(file);
    if (reason !== null) {
      unresolved.push({ fileId: file.id, name: file.name, reason });
      continue;
    }
    // `unresolvedReason` returning null guarantees a usable reference.
    const reference = file.stagedPath as string;
    seen.set(reference, (seen.get(reference) ?? 0) + 1);
  }

  for (const file of files) {
    if (unresolvedReason(file) !== null) continue;
    const reference = file.stagedPath as string;
    if ((seen.get(reference) ?? 0) > 1) {
      unresolved.push({
        fileId: file.id,
        name: file.name,
        reason: "duplicate-reference",
      });
    }
  }

  return unresolved;
};

// ---------------------------------------------------------------------------
// Ledger queries
// ---------------------------------------------------------------------------

/** What this owner already knows about a reference, or `null` if never sent. */
export const referenceDisposition = (
  state: SubmissionState,
  reference: string,
): ReferenceDisposition | null =>
  state.references.find((record) => record.reference === reference)
    ?.disposition ?? null;

const withDisposition = (
  records: readonly ReferenceRecord[],
  references: readonly string[],
  disposition: ReferenceDisposition,
): readonly ReferenceRecord[] => {
  const updated = records.map((record) =>
    references.includes(record.reference) ? { ...record, disposition } : record,
  );
  const known = new Set(updated.map((record) => record.reference));
  for (const reference of references) {
    if (!known.has(reference)) {
      updated.push({ reference, disposition });
      known.add(reference);
    }
  }
  return updated;
};

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type BeginSubmissionResult =
  | {
      readonly kind: "started";
      readonly state: SubmissionState;
      readonly attempt: SubmissionAttempt;
    }
  | {
      readonly kind: "refused";
      readonly state: SubmissionState;
      readonly block: SubmissionBlock;
    };

/**
 * Validates, freezes and marks one attempt as in flight.
 *
 * The order is deliberate. The in-flight status and the reference marks are
 * part of the *returned state*, so a caller that assigns it synchronously —
 * before awaiting anything — holds the duplicate-start guard by construction.
 *
 * References are marked `possibly-consumed` here rather than on settlement.
 * Between dispatch and response the honest disposition is "the server may have
 * it", and a caller torn down in that window must not leave them reusable.
 * Settlement then upgrades them to `consumed` or, for a definite rejection
 * only, downgrades them to `unvalidated`.
 */
export const beginSubmission = (
  state: SubmissionState,
  request: SubmissionRequest,
  attemptId: number,
): BeginSubmissionResult => {
  // A refusal records *what was refused* and changes nothing else. Moving the
  // attempt to a refused state would drop an accepted process reference, an
  // unknown outcome's uncertainty, the retained sharing intent or a running
  // attempt — and the next submission would then pass the status guard below
  // without the explicit discard this design requires.
  const refuse = (block: SubmissionBlock): BeginSubmissionResult => ({
    kind: "refused",
    block,
    state: { ...state, blocked: block },
  });

  if (state.status === "starting") {
    // Refused, not queued: a queued repeat is a second start with extra steps.
    return refuse({ kind: "already-starting" });
  }
  if (state.status === "accepted") return refuse({ kind: "attempt-accepted" });
  if (state.status === "unknown") return refuse({ kind: "attempt-unknown" });

  if (request.files.length === 0) return refuse({ kind: "no-files" });

  const unresolved = findUnresolvedFiles(request.files);
  if (unresolved.length > 0) {
    return refuse({ kind: "unresolved-files", files: unresolved });
  }

  const unusable: UnusableReference[] = [];
  for (const file of request.files) {
    const reference = file.stagedPath as string;
    const disposition = referenceDisposition(state, reference);
    if (disposition !== null) {
      unusable.push({
        fileId: file.id,
        name: file.name,
        reference,
        disposition,
      });
    }
  }
  if (unusable.length > 0) {
    return refuse({ kind: "references-unusable", files: unusable });
  }

  const references = request.files.map((file) => file.stagedPath as string);
  const submission = freezeDeep<FrozenSubmission>({
    startInput: {
      ...request.metadata,
      dataLocations: references.map((location) => ({
        kind: DATA_LOCATION_KIND.File,
        location,
      })),
    },
    sharing: request.sharing,
    references,
  });
  const attempt: SubmissionAttempt = Object.freeze({ attemptId, submission });

  return {
    kind: "started",
    attempt,
    state: {
      status: "starting",
      attempt,
      processInstanceId: null,
      rejection: null,
      unknownFailure: null,
      blocked: null,
      references: withDisposition(
        state.references,
        submission.references,
        "possibly-consumed",
      ),
    },
  };
};

/**
 * Applies the adapter's outcome to the attempt it belongs to.
 *
 * A result whose `attemptId` is not the running attempt is dropped and the
 * state returned unchanged: a superseded or already-settled attempt may not
 * overwrite a newer one. The three outcomes stay distinct — an accepted
 * process identity, a definite pre-start rejection, and an unknown outcome are
 * different facts, and only the adapter decides which is which.
 */
export const settleSubmission = (
  state: SubmissionState,
  attemptId: number,
  outcome: StartOutcome,
): SubmissionState => {
  if (state.status !== "starting") return state;
  if (state.attempt === null || state.attempt.attemptId !== attemptId) {
    return state;
  }
  const references = state.attempt.submission.references;

  if (outcome.kind === "accepted") {
    return {
      ...state,
      status: "accepted",
      blocked: null,
      processInstanceId: outcome.processInstanceId,
      references: withDisposition(state.references, references, "consumed"),
    };
  }

  if (outcome.kind === "rejected") {
    // Nothing was persisted, so the references were not consumed — but
    // "not consumed by this request" is not "still valid", so they stay
    // unusable until evidence says otherwise.
    return {
      ...state,
      status: "rejected",
      blocked: null,
      rejection: { httpStatus: outcome.httpStatus },
      references: withDisposition(state.references, references, "unvalidated"),
    };
  }

  // Unknown: the references keep the `possibly-consumed` mark set at dispatch,
  // and no automatic retry, title lookup or replay follows from this state.
  return {
    ...state,
    status: "unknown",
    blocked: null,
    unknownFailure: outcome.failure,
  };
};

/**
 * Ends the current attempt deliberately and returns the owner to idle.
 *
 * The reference ledger is carried over untouched. That is the whole point: a
 * discard is how a contributor moves on after an unknown outcome or a
 * rejection, and it must not become the way consumed references come back. A
 * later process failure does not reach this function at all — failure is
 * monitoring state, not a submission transition.
 */
export const discardAttempt = (state: SubmissionState): SubmissionState => {
  if (state.status === "starting") return state;
  return {
    ...initialSubmissionState(),
    references: state.references,
  };
};

/**
 * Lifts `unvalidated` marks for the references the supplied evidence covers.
 *
 * Consumed and possibly-consumed references are deliberately left alone: no
 * evidence a caller can supply makes an upload the server may already hold
 * safe to send again within this owner.
 */
export const applyStagingValidityEvidence = (
  state: SubmissionState,
  evidence: StagingValidityEvidence,
): SubmissionState => {
  const covered = new Set(evidence.references);
  const references = state.references.filter(
    (record) =>
      !(covered.has(record.reference) && record.disposition === "unvalidated"),
  );
  return references.length === state.references.length
    ? state
    : { ...state, references };
};
