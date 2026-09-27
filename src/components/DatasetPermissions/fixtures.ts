/**
 * Synthetic scenarios for the dataset group access view.
 *
 * Development, test and Storybook only. Nothing here was observed: the group
 * ids come from `lib/datasetPermissions/fixtures`, whose `provenance.ts` states
 * that the whole set is hand-built from pinned Gateway source and that no
 * authenticated request has ever been made for this feature. A screenshot of
 * any of these states is a picture of a proposal, not evidence that the
 * Gateway behaves this way.
 */

import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import type { DatasetRoleOperationState } from "@/hooks/useDatasetPermissions";
import {
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import { selectAccessMode } from "@/lib/datasetPermissions/mode";
import type {
  EveryoneDiscovery,
  UserGroupRef,
} from "@/lib/datasetPermissions/types";
import type {
  DatasetAccessCapabilities,
  DatasetAccessViewProps,
} from "./types";

export const DATASET_NAME = "Baltic Sea Salinity Profiles 2019-2024";

export const SCOPE_KEY = "principal-a|https://gateway.example|dataset-1";

/** A name long enough to test wrapping against the role columns. */
export const LONG_GROUP_NAME =
  "Consortium Reviewers for Marine Biogeochemistry and Long-Term Salinity Monitoring";

export const EVERYONE_GROUP: UserGroupRef = {
  id: EVERYONE_GROUP_ID,
  name: "Everyone",
  semantics: ["everyone"],
};

export const RESEARCH_GROUP: UserGroupRef = {
  id: RESEARCH_GROUP_ID,
  name: "Baltic Modelling Team",
  semantics: [],
};

export const LONG_NAMED_GROUP: UserGroupRef = {
  id: SECOND_GROUP_ID,
  name: LONG_GROUP_NAME,
  semantics: [],
};

export const DISCOVERED_GROUPS: readonly UserGroupRef[] = [
  EVERYONE_GROUP,
  RESEARCH_GROUP,
  LONG_NAMED_GROUP,
];

export const EVERYONE_IDENTIFIED: EveryoneDiscovery = {
  kind: "identified",
  group: EVERYONE_GROUP,
};

export const EVERYONE_AMBIGUOUS: EveryoneDiscovery = {
  kind: "unavailable",
  reason: "multiple-matches",
};

/** A second group carrying the Everyone semantic: the ambiguous deployment. */
export const DUPLICATE_EVERYONE_GROUP: UserGroupRef = {
  id: "3e4d5c6b-7a89-4b0c-9d1e-2f3a4b5c6d7e",
  name: "All Users",
  semantics: ["everyone"],
};

/**
 * Discovery that actually produces {@link EVERYONE_AMBIGUOUS}: two Everyone
 * candidates beside ordinary groups. Pair them, so a scenario never claims
 * ambiguity over groups that would identify a single audience.
 */
export const AMBIGUOUS_GROUPS: readonly UserGroupRef[] = [
  EVERYONE_GROUP,
  DUPLICATE_EVERYONE_GROUP,
  RESEARCH_GROUP,
  LONG_NAMED_GROUP,
];

export const ALL_ALLOWED: DatasetAccessCapabilities = {
  grant: "allowed",
  revoke: "allowed",
  lookupRecipients: "allowed",
};

export const READ_ONLY_CAPABILITIES: DatasetAccessCapabilities = {
  grant: "not-permitted",
  revoke: "not-permitted",
  lookupRecipients: "allowed",
};

export const RECIPIENTS_UNSUPPORTED: DatasetAccessCapabilities = {
  grant: "allowed",
  revoke: "allowed",
  lookupRecipients: "not-permitted",
};

export const UNKNOWN_CAPABILITIES: DatasetAccessCapabilities = {
  grant: "unknown",
  revoke: "unknown",
  lookupRecipients: "unknown",
};

export const KNOWN_GRANTS = [
  { groupId: RESEARCH_GROUP_ID, role: DATASET_ROLE_MAP.browse },
  { groupId: RESEARCH_GROUP_ID, role: DATASET_ROLE_MAP.download },
  { groupId: SECOND_GROUP_ID, role: DATASET_ROLE_MAP.browse },
] as const;

export const operation = (
  overrides: Partial<DatasetRoleOperationState> = {},
): DatasetRoleOperationState => ({
  operationId: "op-1",
  groupId: RESEARCH_GROUP_ID,
  role: DATASET_ROLE_MAP.edit,
  action: "assign",
  status: "pending",
  restored: false,
  ...overrides,
});

/**
 * The default: everything read, everything permitted. Every other scenario is
 * this one with a single fact removed, which is what makes the states
 * comparable in a story sweep.
 */
export const baseProps = (
  overrides: Partial<DatasetAccessViewProps> = {},
): DatasetAccessViewProps => {
  const defaults = {
    datasetName: DATASET_NAME,
    scopeKey: SCOPE_KEY,
    reads: {
      status: "settled",
      groups: { kind: "read", groups: DISCOVERED_GROUPS },
      recipients: { kind: "known", grants: [...KNOWN_GRANTS] },
    },
    capabilities: ALL_ALLOWED,
    everyone: EVERYONE_IDENTIFIED,
    operations: [],
    storageAvailable: true,
    canAttempt: () => ({ kind: "allowed" as const }),
    onRoleChange: () => undefined,
    onDone: () => undefined,
  } satisfies Omit<DatasetAccessViewProps, "mode">;

  const merged = { ...defaults, ...overrides };

  // The mode is *derived from the same evidence the view is given*, unless a
  // scenario states it explicitly. A fixture that hand-picked a presentation
  // could show the grant-only form beside readable recipients — a combination
  // `selectAccessMode` never produces — and a story of an impossible state is
  // worse than no story.
  return {
    ...merged,
    mode:
      overrides.mode ??
      selectAccessMode({
        scopeResolved: true,
        settled: merged.reads.status === "settled",
        capabilities: merged.capabilities,
        groups:
          merged.reads.status === "settled"
            ? merged.reads.groups
            : { kind: "unknown" },
        recipients:
          merged.reads.status === "settled"
            ? merged.reads.recipients
            : { kind: "unknown", reason: "not-read" },
      }),
  };
};
