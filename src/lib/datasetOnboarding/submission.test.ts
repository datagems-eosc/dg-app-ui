import { describe, expect, it } from "vitest";
import {
  applyStagingValidityEvidence,
  beginSubmission,
  discardAttempt,
  type FrozenSubmission,
  findUnresolvedFiles,
  initialSubmissionState,
  type OnboardingMetadataInput,
  type RetainedFile,
  referenceDisposition,
  type SharingIntent,
  type SubmissionRequest,
  type SubmissionState,
  settleSubmission,
} from "./submission";
import {
  asProcessInstanceId,
  DATA_LOCATION_KIND,
  type StartOutcome,
} from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROCESS = asProcessInstanceId("6a0f1d27-1c2e-4f63-9b55-0a7c3d81e4f2");

const metadata = (): OnboardingMetadataInput => ({
  name: "Sensor readings 2026",
  description: "Hourly readings from the pilot network.",
  license: "CC-BY-4.0",
  headline: "Pilot network readings",
  keywords: ["sensors", "pilot"],
  fieldOfScience: ["Environmental science"],
  datePublished: "2026-09-23",
  language: ["en"],
});

const sharing = (): SharingIntent => ({
  visibility: "restricted",
  groups: [{ groupId: "group-a", roles: ["dg_ds-view"] }],
});

const uploaded = (
  id: string,
  stagedPath: string,
  name = `${id}.csv`,
): RetainedFile => ({ id, name, status: "success", stagedPath });

const request = (
  files: readonly RetainedFile[],
  overrides: Partial<SubmissionRequest> = {},
): SubmissionRequest => ({
  files,
  metadata: metadata(),
  sharing: sharing(),
  ...overrides,
});

const FILES = [
  uploaded("f1", "staged/one.csv"),
  uploaded("f2", "staged/two.csv"),
];

/**
 * The retained intent of an attempt begun with a legacy non-null selection.
 * Fails loudly rather than silently asserting against `undefined`.
 */
const frozenIntent = (submission: FrozenSubmission): SharingIntent => {
  if (submission.sharing === null) {
    throw new Error("expected a retained sharing intent");
  }
  return submission.sharing;
};

/** Begins an attempt and fails loudly rather than returning a refusal shape. */
const started = (state: SubmissionState, files: readonly RetainedFile[]) => {
  const begun = beginSubmission(state, request(files), 1);
  if (begun.kind !== "started") {
    throw new Error(`expected a started attempt, got ${begun.block.kind}`);
  }
  return begun;
};

const settledWith = (
  outcome: StartOutcome,
  files: readonly RetainedFile[] = FILES,
): SubmissionState => {
  const begun = started(initialSubmissionState(), files);
  return settleSubmission(begun.state, 1, outcome);
};

const ACCEPTED: StartOutcome = {
  kind: "accepted",
  processInstanceId: PROCESS,
};
const REJECTED: StartOutcome = { kind: "rejected", httpStatus: 400 };
const UNKNOWN: StartOutcome = {
  kind: "unknown",
  failure: { kind: "forbidden", httpStatus: 403 },
};

// ---------------------------------------------------------------------------
// Retained-file validation (architect ruling D7)
// ---------------------------------------------------------------------------

describe("retained-file validation", () => {
  it("requires at least one retained file", () => {
    const begun = beginSubmission(initialSubmissionState(), request([]), 1);

    expect(begun.kind).toBe("refused");
    if (begun.kind !== "refused") return;
    expect(begun.block).toEqual({ kind: "no-files" });
    // The refusal is recorded without moving the attempt anywhere.
    expect(begun.state.status).toBe("idle");
    expect(begun.state.blocked).toEqual({ kind: "no-files" });
  });

  it("blocks on every unresolved file instead of submitting the rest", () => {
    const files: readonly RetainedFile[] = [
      uploaded("ok", "staged/ok.csv"),
      { id: "busy", name: "busy.csv", status: "uploading" },
      { id: "broken", name: "broken.csv", status: "error" },
      { id: "empty", name: "empty.csv", status: "success" },
      { id: "blank", name: "blank.csv", status: "success", stagedPath: "   " },
    ];

    const begun = beginSubmission(initialSubmissionState(), request(files), 1);

    expect(begun.kind).toBe("refused");
    if (begun.kind !== "refused") return;
    expect(begun.block).toEqual({
      kind: "unresolved-files",
      files: [
        { fileId: "busy", name: "busy.csv", reason: "uploading" },
        { fileId: "broken", name: "broken.csv", reason: "failed" },
        { fileId: "empty", name: "empty.csv", reason: "missing-reference" },
        { fileId: "blank", name: "blank.csv", reason: "invalid-reference" },
      ],
    });
    // The one good file is *not* quietly submitted on its own.
    expect(begun.state.status).toBe("idle");
    expect(begun.state.attempt).toBeNull();
    expect(begun.state.references).toEqual([]);
  });

  it("refuses a reference carrying control bytes", () => {
    const files = [uploaded("f1", "staged/one\u0000.csv")];

    expect(findUnresolvedFiles(files)).toEqual([
      { fileId: "f1", name: "f1.csv", reason: "invalid-reference" },
    ]);
  });

  it("names both files when two retain the same reference", () => {
    const files = [
      uploaded("f1", "staged/same.csv"),
      uploaded("f2", "staged/same.csv"),
      uploaded("f3", "staged/other.csv"),
    ];

    expect(findUnresolvedFiles(files)).toEqual([
      { fileId: "f1", name: "f1.csv", reason: "duplicate-reference" },
      { fileId: "f2", name: "f2.csv", reason: "duplicate-reference" },
    ]);
  });

  it("accepts a complete retained set", () => {
    expect(findUnresolvedFiles(FILES)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Freezing
// ---------------------------------------------------------------------------

describe("frozen attempt input", () => {
  it("maps one File location per retained file, in order and verbatim", () => {
    const { attempt } = started(initialSubmissionState(), FILES);

    expect(attempt.submission.startInput.dataLocations).toEqual([
      { kind: DATA_LOCATION_KIND.File, location: "staged/one.csv" },
      { kind: DATA_LOCATION_KIND.File, location: "staged/two.csv" },
    ]);
    // Not the single-directory `Staged` contract: N locations, kind File.
    expect(
      attempt.submission.startInput.dataLocations.every(
        (location) => location.kind !== DATA_LOCATION_KIND.Staged,
      ),
    ).toBe(true);
  });

  it("is unaffected by later edits to the caller's own objects", () => {
    const keywords = ["sensors", "pilot"];
    const groups = [{ groupId: "group-a", roles: ["dg_ds-view"] }];
    const files = [uploaded("f1", "staged/one.csv")];
    const pending: SubmissionRequest = {
      files,
      metadata: { ...metadata(), keywords },
      sharing: { visibility: "restricted", groups },
    };

    const frozen = beginSubmission(initialSubmissionState(), pending, 1);
    if (frozen.kind !== "started")
      throw new Error("expected a started attempt");

    // The caller keeps editing the form after submitting.
    keywords.push("mutated");
    groups[0].roles.push("dg_ds-manage");
    groups.push({ groupId: "group-b", roles: ["dg_ds-view"] });
    files.push(uploaded("f2", "staged/two.csv"));

    expect(frozen.attempt.submission.startInput.keywords).toEqual([
      "sensors",
      "pilot",
    ]);
    expect(frozenIntent(frozen.attempt.submission).groups).toEqual([
      { groupId: "group-a", roles: ["dg_ds-view"] },
    ]);
    expect(frozen.attempt.submission.references).toEqual(["staged/one.csv"]);
    expect(frozen.attempt.submission.startInput.dataLocations).toHaveLength(1);
  });

  it("freezes nested values so the snapshot cannot be rewritten in place", () => {
    const { attempt } = started(initialSubmissionState(), FILES);
    const { startInput } = attempt.submission;
    const intent = frozenIntent(attempt.submission);

    expect(Object.isFrozen(startInput)).toBe(true);
    expect(Object.isFrozen(startInput.keywords)).toBe(true);
    expect(Object.isFrozen(startInput.dataLocations)).toBe(true);
    expect(Object.isFrozen(startInput.dataLocations[0])).toBe(true);
    expect(Object.isFrozen(intent.groups[0])).toBe(true);
    expect(Object.isFrozen(intent.groups[0]?.roles)).toBe(true);
    expect(() => {
      (startInput.dataLocations as { length: number }).length = 0;
    }).toThrow(TypeError);
  });

  it("does not freeze the caller's own request objects", () => {
    const ownSharing = sharing();
    const own = request(FILES, { sharing: ownSharing });

    beginSubmission(initialSubmissionState(), own, 1);

    // Freezing the caller's form data would be our bug, not their protection.
    expect(Object.isFrozen(own.metadata.keywords)).toBe(false);
    expect(Object.isFrozen(ownSharing.groups)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Duplicate start
// ---------------------------------------------------------------------------

describe("duplicate start", () => {
  it("refuses a second begin while one is in flight, keeping the first", () => {
    const first = started(initialSubmissionState(), FILES);

    const second = beginSubmission(first.state, request(FILES), 2);

    expect(second.kind).toBe("refused");
    if (second.kind !== "refused") return;
    expect(second.block).toEqual({ kind: "already-starting" });
    // The running attempt survives the repeat untouched.
    expect(second.state.status).toBe("starting");
    expect(second.state.attempt).toBe(first.state.attempt);
    expect(second.state.attempt?.attemptId).toBe(1);
    expect(second.state.references).toEqual(first.state.references);
  });

  it("refuses a further submission while an attempt is accepted or unknown", () => {
    const fresh = [uploaded("f3", "staged/three.csv")];

    const afterAccepted = beginSubmission(
      settledWith(ACCEPTED),
      request(fresh),
      2,
    );
    const afterUnknown = beginSubmission(
      settledWith(UNKNOWN),
      request(fresh),
      2,
    );

    expect(afterAccepted.kind === "refused" && afterAccepted.block).toEqual({
      kind: "attempt-accepted",
    });
    expect(afterUnknown.kind === "refused" && afterUnknown.block).toEqual({
      kind: "attempt-unknown",
    });
  });
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

describe("settling an attempt", () => {
  it("keeps the accepted process identity", () => {
    const state = settledWith(ACCEPTED);

    expect(state.status).toBe("accepted");
    expect(state.processInstanceId).toBe(PROCESS);
    expect(state.rejection).toBeNull();
    expect(state.unknownFailure).toBeNull();
  });

  it("keeps a definite rejection distinct from an unknown outcome", () => {
    const rejected = settledWith(REJECTED);
    const unknown = settledWith(UNKNOWN);

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejection).toEqual({ httpStatus: 400 });
    expect(rejected.processInstanceId).toBeNull();

    expect(unknown.status).toBe("unknown");
    expect(unknown.unknownFailure).toEqual({
      kind: "forbidden",
      httpStatus: 403,
    });
    // An unknown start never borrows an identity it did not receive.
    expect(unknown.processInstanceId).toBeNull();
    expect(unknown.rejection).toBeNull();
  });

  it("drops a result belonging to another attempt", () => {
    const begun = started(initialSubmissionState(), FILES);

    const settled = settleSubmission(begun.state, 7, ACCEPTED);

    expect(settled).toBe(begun.state);
    expect(settled.status).toBe("starting");
  });

  it("drops a second result for an attempt that already settled", () => {
    const accepted = settledWith(ACCEPTED);

    expect(settleSubmission(accepted, 1, REJECTED)).toBe(accepted);
  });
});

// ---------------------------------------------------------------------------
// Reference disposition
// ---------------------------------------------------------------------------

describe("consumed upload references", () => {
  it("marks references as possibly consumed the moment a start is dispatched", () => {
    const { state } = started(initialSubmissionState(), FILES);

    expect(referenceDisposition(state, "staged/one.csv")).toBe(
      "possibly-consumed",
    );
    expect(referenceDisposition(state, "staged/two.csv")).toBe(
      "possibly-consumed",
    );
    expect(referenceDisposition(state, "staged/never-sent.csv")).toBeNull();
  });

  it("consumes them on acceptance and keeps them unusable after a discard", () => {
    const accepted = settledWith(ACCEPTED);
    expect(referenceDisposition(accepted, "staged/one.csv")).toBe("consumed");

    const afterDiscard = discardAttempt(accepted);

    expect(afterDiscard.status).toBe("idle");
    expect(afterDiscard.attempt).toBeNull();
    expect(afterDiscard.processInstanceId).toBeNull();
    expect(referenceDisposition(afterDiscard, "staged/one.csv")).toBe(
      "consumed",
    );

    const replay = beginSubmission(afterDiscard, request(FILES), 2);

    expect(replay.kind).toBe("refused");
    if (replay.kind !== "refused") return;
    expect(replay.block).toEqual({
      kind: "references-unusable",
      files: [
        {
          fileId: "f1",
          name: "f1.csv",
          reference: "staged/one.csv",
          disposition: "consumed",
        },
        {
          fileId: "f2",
          name: "f2.csv",
          reference: "staged/two.csv",
          disposition: "consumed",
        },
      ],
    });
  });

  it("keeps an unknown attempt's references unusable", () => {
    const afterDiscard = discardAttempt(settledWith(UNKNOWN));

    expect(referenceDisposition(afterDiscard, "staged/one.csv")).toBe(
      "possibly-consumed",
    );
    expect(beginSubmission(afterDiscard, request(FILES), 2).kind).toBe(
      "refused",
    );
  });

  it("still refuses reuse of a rejected attempt's references without evidence", () => {
    const afterDiscard = discardAttempt(settledWith(REJECTED));

    // Not consumed — but "this request was refused" is not "the upload is
    // still there", so the reference stays unusable until evidence says so.
    expect(referenceDisposition(afterDiscard, "staged/one.csv")).toBe(
      "unvalidated",
    );
    expect(beginSubmission(afterDiscard, request(FILES), 2).kind).toBe(
      "refused",
    );
  });

  it("permits reuse of rejected references once renewed validity is supplied", () => {
    const afterDiscard = discardAttempt(settledWith(REJECTED));

    const revalidated = applyStagingValidityEvidence(afterDiscard, {
      references: ["staged/one.csv", "staged/two.csv"],
      source: "operator re-checked the staged uploads",
    });

    expect(referenceDisposition(revalidated, "staged/one.csv")).toBeNull();
    const retried = beginSubmission(revalidated, request(FILES), 2);
    expect(retried.kind).toBe("started");
  });

  it("refuses to revive consumed or possibly consumed references", () => {
    const evidence = {
      references: ["staged/one.csv", "staged/two.csv"],
      source: "an optimistic caller",
    };

    const accepted = applyStagingValidityEvidence(
      discardAttempt(settledWith(ACCEPTED)),
      evidence,
    );
    const unknown = applyStagingValidityEvidence(
      discardAttempt(settledWith(UNKNOWN)),
      evidence,
    );

    expect(referenceDisposition(accepted, "staged/one.csv")).toBe("consumed");
    expect(referenceDisposition(unknown, "staged/one.csv")).toBe(
      "possibly-consumed",
    );
  });

  it("lets a fresh upload be submitted after an accepted attempt is discarded", () => {
    const afterDiscard = discardAttempt(settledWith(ACCEPTED));

    const next = beginSubmission(
      afterDiscard,
      request([uploaded("f3", "staged/three.csv")]),
      2,
    );

    expect(next.kind).toBe("started");
    // The earlier attempt's references are still on the ledger.
    expect(referenceDisposition(next.state, "staged/one.csv")).toBe("consumed");
  });

  it("refuses to discard an attempt that is still in flight", () => {
    const { state } = started(initialSubmissionState(), FILES);

    expect(discardAttempt(state)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// A refused action must not consume the settled attempt (R1)
// ---------------------------------------------------------------------------

describe("a refused submission preserves the settled attempt", () => {
  const FRESH_B = [uploaded("f3", "staged/three.csv")];
  const FRESH_C = [uploaded("f4", "staged/four.csv")];

  it("keeps an accepted attempt through consecutive refusals", () => {
    const accepted = settledWith(ACCEPTED);

    // The returned states are applied consecutively, as a caller would: the
    // second refusal has to see what the first one left behind.
    const first = beginSubmission(accepted, request(FRESH_B), 2);
    const second = beginSubmission(first.state, request(FRESH_C), 3);

    expect(first.kind).toBe("refused");
    expect(second.kind).toBe("refused");
    expect(first.state.status).toBe("accepted");
    expect(second.state.status).toBe("accepted");
    expect(second.state.processInstanceId).toBe(PROCESS);
    expect(second.state.attempt?.submission.sharing).toEqual(sharing());
    expect(second.state.attempt?.submission.references).toEqual([
      "staged/one.csv",
      "staged/two.csv",
    ]);
    expect(referenceDisposition(second.state, "staged/one.csv")).toBe(
      "consumed",
    );
    // The refusal is reported without displacing the outcome.
    expect(second.state.blocked).toEqual({ kind: "attempt-accepted" });
  });

  it("keeps an unknown attempt through consecutive refusals", () => {
    const unknown = settledWith(UNKNOWN);

    const first = beginSubmission(unknown, request(FRESH_B), 2);
    const second = beginSubmission(first.state, request(FRESH_C), 3);

    expect(first.kind).toBe("refused");
    expect(second.kind).toBe("refused");
    expect(first.state.status).toBe("unknown");
    expect(second.state.status).toBe("unknown");
    expect(second.state.unknownFailure).toEqual({
      kind: "forbidden",
      httpStatus: 403,
    });
    expect(referenceDisposition(second.state, "staged/one.csv")).toBe(
      "possibly-consumed",
    );
    expect(second.state.blocked).toEqual({ kind: "attempt-unknown" });
  });

  it("keeps a definite rejection through a refusal of the same files", () => {
    const rejected = settledWith(REJECTED);

    const refused = beginSubmission(rejected, request(FILES), 2);

    expect(refused.kind).toBe("refused");
    expect(refused.state.status).toBe("rejected");
    expect(refused.state.rejection).toEqual({ httpStatus: 400 });
  });

  it("keeps a running attempt through a refused repeat", () => {
    const { state } = started(initialSubmissionState(), FILES);

    const first = beginSubmission(state, request(FRESH_B), 2);
    const second = beginSubmission(first.state, request(FRESH_C), 3);

    expect(second.kind).toBe("refused");
    expect(second.state.status).toBe("starting");
    expect(second.state.attempt?.attemptId).toBe(1);
  });

  it("control: an explicit discard after refusals permits fresh files", () => {
    const accepted = settledWith(ACCEPTED);
    const refused = beginSubmission(accepted, request(FRESH_B), 2);

    const afterDiscard = discardAttempt(refused.state);
    const next = beginSubmission(afterDiscard, request(FRESH_B), 3);

    expect(next.kind).toBe("started");
    expect(afterDiscard.blocked).toBeNull();
    // Discarding still releases nothing the earlier attempt sent.
    expect(referenceDisposition(next.state, "staged/one.csv")).toBe("consumed");
    expect(referenceDisposition(next.state, "staged/two.csv")).toBe("consumed");
  });
});

// ---------------------------------------------------------------------------
// Private submissions: no sharing was requested
// ---------------------------------------------------------------------------

describe("no sharing requested", () => {
  it("accepts a null intent and freezes it as null, not as a selection", () => {
    const begun = beginSubmission(
      initialSubmissionState(),
      request(FILES, { sharing: null }),
      1,
    );

    expect(begun.kind).toBe("started");
    if (begun.kind !== "started") return;
    // Not a fabricated "restricted with no groups": that would claim a choice
    // the contributor was never offered.
    expect(begun.attempt.submission.sharing).toBeNull();
    expect(begun.attempt.submission.startInput.dataLocations).toEqual([
      { kind: DATA_LOCATION_KIND.File, location: "staged/one.csv" },
      { kind: DATA_LOCATION_KIND.File, location: "staged/two.csv" },
    ]);
  });

  it("carries the null intent through every outcome unchanged", () => {
    for (const outcome of [ACCEPTED, REJECTED, UNKNOWN]) {
      const begun = started(initialSubmissionState(), FILES);
      const withNull = beginSubmission(
        initialSubmissionState(),
        request(FILES, { sharing: null }),
        1,
      );
      if (withNull.kind !== "started") throw new Error("expected a start");
      const settled = settleSubmission(withNull.state, 1, outcome);

      expect(settled.attempt?.submission.sharing).toBeNull();
      // The legacy path is untouched by the new one.
      expect(frozenIntent(begun.attempt.submission).visibility).toBe(
        "restricted",
      );
    }
  });

  it("applies the same file rules to a private submission", () => {
    const refused = beginSubmission(
      initialSubmissionState(),
      request(
        [
          uploaded("f1", "staged/one.csv"),
          { id: "f2", name: "b.csv", status: "uploading" },
        ],
        {
          sharing: null,
        },
      ),
      1,
    );

    expect(refused.kind).toBe("refused");
    if (refused.kind !== "refused") return;
    expect(refused.block).toEqual({
      kind: "unresolved-files",
      files: [{ fileId: "f2", name: "b.csv", reason: "uploading" }],
    });
  });

  it("does not let a private attempt revive references an earlier one sent", () => {
    const accepted = settledWith(ACCEPTED);

    const next = beginSubmission(
      accepted,
      request(FILES, { sharing: null }),
      2,
    );

    expect(next.kind).toBe("refused");
    if (next.kind !== "refused") return;
    expect(next.block.kind).toBe("attempt-accepted");
  });
});
