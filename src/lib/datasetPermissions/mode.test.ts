import { describe, expect, it } from "vitest";
import { EVERYONE_GROUP_ID, RESEARCH_GROUP_ID } from "./fixtures";
import {
  type AccessCapabilities,
  type AccessModeEvidence,
  selectAccessMode,
  UNKNOWN_CAPABILITIES,
} from "./mode";
import type { GroupDiscoveryState, RecipientGrantsState } from "./types";

/**
 * The selector decides what a caller is shown. Two mistakes matter more than
 * the rest, and most of this file is about them:
 *
 *  1. showing the **full editor** without readable recipients, which draws
 *     every unknown role as an off switch and reads as "nobody has access";
 *  2. falling back to the **grant-only form** because a read broke. The form
 *     is correct for a confirmed policy and wrong for an outage, and the two
 *     arrive at this function looking similar.
 */

const GROUPS_READ: GroupDiscoveryState = {
  kind: "read",
  groups: [
    { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
    { id: RESEARCH_GROUP_ID, name: "Research", semantics: [] },
  ],
};

const RECIPIENTS_KNOWN: RecipientGrantsState = { kind: "known", grants: [] };
const RECIPIENTS_REFUSED: RecipientGrantsState = {
  kind: "unknown",
  reason: "not-supported",
};
const RECIPIENTS_NOT_READ: RecipientGrantsState = {
  kind: "unknown",
  reason: "not-read",
};
const RECIPIENTS_FAILED: RecipientGrantsState = { kind: "failed" };

const CAN_GRANT_ONLY: AccessCapabilities = {
  grant: "allowed",
  revoke: "unknown",
  lookupRecipients: "not-permitted",
};

const evidence = (
  overrides: Partial<AccessModeEvidence> = {},
): AccessModeEvidence => ({
  scopeResolved: true,
  settled: true,
  capabilities: UNKNOWN_CAPABILITIES,
  groups: GROUPS_READ,
  recipients: RECIPIENTS_NOT_READ,
  ...overrides,
});

describe("before anything can be decided", () => {
  it("is unavailable without a resolved owner, even once reads are settled", () => {
    expect(selectAccessMode(evidence({ scopeResolved: false }))).toEqual({
      kind: "unavailable",
      reason: "identity-unresolved",
    });
  });

  it("is loading while a read this decision depends on is outstanding", () => {
    expect(selectAccessMode(evidence({ settled: false }))).toEqual({
      kind: "loading",
    });
  });

  it("does not report loading before the owner exists", () => {
    // Order matters: an unresolved owner is not "about to resolve", and a
    // spinner that never finishes is worse than an explanation.
    expect(
      selectAccessMode(evidence({ scopeResolved: false, settled: false })).kind,
    ).toBe("unavailable");
  });
});

describe("the full editor", () => {
  it("is selected by successful recipient reads", () => {
    expect(
      selectAccessMode(evidence({ recipients: RECIPIENTS_KNOWN })).kind,
    ).toBe("full-editor");
  });

  it("is selected even when no write capability is allowed, as the read-only case", () => {
    // Read-only is the full editor with no controls offered, not a different
    // presentation: the evidence that decides what is *shown* is the same.
    expect(
      selectAccessMode(
        evidence({
          recipients: RECIPIENTS_KNOWN,
          capabilities: {
            grant: "not-permitted",
            revoke: "not-permitted",
            lookupRecipients: "allowed",
          },
        }),
      ).kind,
    ).toBe("full-editor");
  });

  it("is selected for readable recipients even with no groups left to show", () => {
    expect(
      selectAccessMode(
        evidence({
          recipients: RECIPIENTS_KNOWN,
          groups: { kind: "read", groups: [] },
        }),
      ).kind,
    ).toBe("full-editor");
  });
});

describe("the grant-only form", () => {
  it("is selected by a confirmed lookup restriction, grant capability and usable groups", () => {
    expect(
      selectAccessMode(
        evidence({
          capabilities: CAN_GRANT_ONLY,
          recipients: RECIPIENTS_REFUSED,
        }),
      ).kind,
    ).toBe("grant-only");
  });

  it("is selected without the recipient read having been attempted at all", () => {
    // The orchestrator skips it once the restriction is confirmed, so this is
    // the state the form is normally reached in.
    expect(
      selectAccessMode(
        evidence({
          capabilities: CAN_GRANT_ONLY,
          recipients: RECIPIENTS_NOT_READ,
        }),
      ).kind,
    ).toBe("grant-only");
  });

  it.each([
    ["grant is not permitted", "not-permitted" as const],
    ["grant could not be established", "unknown" as const],
  ])("is refused when %s", (_label, grant) => {
    expect(
      selectAccessMode(
        evidence({
          capabilities: { ...CAN_GRANT_ONLY, grant },
          recipients: RECIPIENTS_REFUSED,
        }),
      ),
    ).toEqual({ kind: "unavailable", reason: "no-grant-capability" });
  });

  it.each([
    ["the group read failed", { kind: "failed" } as GroupDiscoveryState],
    ["groups were never read", { kind: "unknown" } as GroupDiscoveryState],
    [
      "no group is visible",
      { kind: "read", groups: [] } as GroupDiscoveryState,
    ],
  ])(
    "is refused when %s, because there is nothing to grant to",
    (_label, groups) => {
      expect(
        selectAccessMode(
          evidence({
            capabilities: CAN_GRANT_ONLY,
            recipients: RECIPIENTS_REFUSED,
            groups,
          }),
        ),
      ).toEqual({ kind: "unavailable", reason: "no-usable-groups" });
    },
  );
});

/**
 * The fallback the design forbids by name: "Grant-only selection is deliberate
 * supported policy, never a fallback triggered merely by any HTTP 403."
 */
describe("a broken read is never worked around", () => {
  it("does not select grant-only from a failed recipient read", () => {
    expect(
      selectAccessMode(
        evidence({
          // Everything else is exactly the grant-only case.
          capabilities: { ...CAN_GRANT_ONLY, lookupRecipients: "allowed" },
          recipients: RECIPIENTS_FAILED,
        }),
      ),
    ).toEqual({ kind: "unavailable", reason: "recipient-read-failed" });
  });

  it("does not select grant-only from a failed read even with the restriction confirmed", () => {
    expect(
      selectAccessMode(
        evidence({
          capabilities: CAN_GRANT_ONLY,
          recipients: RECIPIENTS_FAILED,
        }),
      ),
    ).toEqual({ kind: "unavailable", reason: "recipient-read-failed" });
  });

  it("treats an unexpected refusal as a refusal, not as policy", () => {
    // The adapter maps 403 to `not-supported` — correct for one response. Only
    // a complete global read deciding `not-permitted` confirms the policy, and
    // this caller's lookup capability was established as *allowed*.
    expect(
      selectAccessMode(
        evidence({
          capabilities: {
            grant: "allowed",
            revoke: "allowed",
            lookupRecipients: "allowed",
          },
          recipients: RECIPIENTS_REFUSED,
        }),
      ),
    ).toEqual({ kind: "unavailable", reason: "recipient-read-refused" });
  });

  it("separates an unestablished lookup capability from a refusal", () => {
    expect(
      selectAccessMode(
        evidence({
          capabilities: { ...UNKNOWN_CAPABILITIES, grant: "allowed" },
          recipients: RECIPIENTS_NOT_READ,
        }),
      ),
    ).toEqual({ kind: "unavailable", reason: "lookup-unconfirmed" });
  });

  it("never selects the full editor without readable recipients", () => {
    for (const recipients of [
      RECIPIENTS_REFUSED,
      RECIPIENTS_NOT_READ,
      RECIPIENTS_FAILED,
    ]) {
      for (const lookupRecipients of [
        "allowed",
        "not-permitted",
        "unknown",
      ] as const) {
        const mode = selectAccessMode(
          evidence({
            recipients,
            capabilities: {
              grant: "allowed",
              revoke: "allowed",
              lookupRecipients,
            },
          }),
        );
        expect(mode.kind).not.toBe("full-editor");
      }
    }
  });
});
