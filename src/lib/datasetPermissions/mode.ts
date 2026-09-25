/**
 * Dataset permissions — which presentation the evidence supports.
 *
 * One pure function, kept apart from the hook that gathers the evidence and
 * from the view that draws it, because *this* is the rule the whole feature
 * turns on: a caller sees the full editor, the grant-only form, or an
 * explanation, and picking the wrong one is how a UI ends up either hiding a
 * permitted action or offering an unauthorized one.
 *
 * Three things it deliberately does not do:
 *
 *  - **it never reads a role or an administrator label.** The inputs are
 *    `decideAction` decisions and read states, nothing else. "Is this person an
 *    admin" is not a question this module can ask;
 *  - **it never falls back.** A failed, malformed or unexpectedly refused
 *    recipient read produces an explanation, never the grant-only form. The
 *    grant-only form is a deliberate presentation for a *confirmed* policy, and
 *    a broken read is not a policy;
 *  - **it never treats the adapter's `not-supported` as policy on its own.**
 *    `gateway.readGroupDatasetGrants` maps HTTP 403 to
 *    `{ kind: "unknown", reason: "not-supported" }`, which is the right thing
 *    for that layer to say about one response. Only a *complete* global
 *    permission read deciding `lookupRecipients` to `not-permitted` confirms
 *    the restriction here. See `model.decideAction` and the
 *    `ContextGrantsDatasetGroupOther` trace in `gateway.ts`.
 */

import type {
  CapabilityDecision,
  GroupDiscoveryState,
  RecipientGrantsState,
} from "./types";

/**
 * What the caller may do, per action, as `model.decideAction` decided it.
 *
 * All three are required: omitting one would collapse "we did not ask" into
 * "we asked and the answer was no", which is the distinction the model exists
 * to preserve.
 */
export interface AccessCapabilities {
  readonly grant: CapabilityDecision;
  readonly revoke: CapabilityDecision;
  readonly lookupRecipients: CapabilityDecision;
}

export const UNKNOWN_CAPABILITIES: AccessCapabilities = {
  grant: "unknown",
  revoke: "unknown",
  lookupRecipients: "unknown",
};

export interface AccessModeEvidence {
  /** `false` while identity or dataset is unresolved. Nothing can be selected. */
  readonly scopeResolved: boolean;
  /** `false` while any read this decision depends on is still in flight. */
  readonly settled: boolean;
  readonly capabilities: AccessCapabilities;
  readonly groups: GroupDiscoveryState;
  readonly recipients: RecipientGrantsState;
}

/**
 * Why neither presentation is offered. Each maps to different wording and,
 * more importantly, to a different remedy: an administrator, a retry, or
 * nothing the user can do.
 */
export type AccessUnavailableReason =
  /** No resolved principal, Gateway or dataset. */
  | "identity-unresolved"
  /** A supported recipient read was attempted and did not complete. */
  | "recipient-read-failed"
  /**
   * The recipient read came back refused, but the caller's lookup capability
   * was not a confirmed negative. An unexpected refusal is not policy, and it
   * must not select grant-only.
   */
  | "recipient-read-refused"
  /** Whether recipient lookup is permitted could not be established at all. */
  | "lookup-unconfirmed"
  /** Lookup is confirmed restricted, and no positive grant capability exists. */
  | "no-grant-capability"
  /** Lookup is confirmed restricted and granting is allowed, but there is no
   * usable target to grant to. */
  | "no-usable-groups";

export type DatasetAccessMode =
  | { readonly kind: "loading" }
  /**
   * Known assignments are displayed. Each write is still gated by its own
   * capability, so this is also the read-only presentation when neither grant
   * nor revoke is allowed — the difference is which controls are offered, not
   * which evidence was found.
   */
  | { readonly kind: "full-editor" }
  /** Explicit group and role choice with a Grant action. No revoke, no summary. */
  | { readonly kind: "grant-only" }
  | {
      readonly kind: "unavailable";
      readonly reason: AccessUnavailableReason;
    };

const unavailable = (reason: AccessUnavailableReason): DatasetAccessMode => ({
  kind: "unavailable",
  reason,
});

/**
 * Select the presentation.
 *
 * Order is the argument. Successful recipient knowledge wins first, because it
 * is the only evidence that can support displaying existing access at all. A
 * failed read is refused next, before any capability is consulted, so no
 * combination of capabilities can turn an outage into a working form. Only
 * then is the confirmed lookup restriction allowed to select grant-only, and
 * only alongside a positive grant capability and something to grant to.
 */
export function selectAccessMode(
  evidence: AccessModeEvidence,
): DatasetAccessMode {
  if (!evidence.scopeResolved) return unavailable("identity-unresolved");
  if (!evidence.settled) return { kind: "loading" };

  const { capabilities, groups, recipients } = evidence;

  // Supported, successful recipient knowledge. Writes are gated separately.
  if (recipients.kind === "known") return { kind: "full-editor" };

  // A read that was attempted and broke is explained, never worked around.
  if (recipients.kind === "failed") return unavailable("recipient-read-failed");

  if (capabilities.lookupRecipients !== "not-permitted") {
    return unavailable(
      recipients.reason === "not-supported"
        ? "recipient-read-refused"
        : "lookup-unconfirmed",
    );
  }

  // From here the restriction is confirmed by a complete global read: this
  // caller may not look up who already has access. That is the one state the
  // grant-only presentation exists for.
  if (capabilities.grant !== "allowed") {
    return unavailable("no-grant-capability");
  }
  if (groups.kind !== "read" || groups.groups.length === 0) {
    return unavailable("no-usable-groups");
  }

  return { kind: "grant-only" };
}
