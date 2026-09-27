import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import { DatasetAccessView } from "./DatasetAccessView";
import {
  ALL_ALLOWED,
  AMBIGUOUS_GROUPS,
  baseProps,
  DATASET_NAME,
  DISCOVERED_GROUPS,
  EVERYONE_AMBIGUOUS,
  KNOWN_GRANTS,
  operation,
  READ_ONLY_CAPABILITIES,
  RECIPIENTS_UNSUPPORTED,
  UNKNOWN_CAPABILITIES,
} from "./fixtures";

/**
 * The dataset group access view, in the frame it is mounted in.
 *
 * The decorator is the existing `DatasetPermissionsModal` shell — same overlay,
 * dimensions, title bar and close control — so these captures show the view at
 * the size it will actually occupy. It is a frame for review, not a second
 * modal implementation: `DatasetGroupAccess` mounts this view inside the real
 * component while the `datasetGroupAccess` flag is on.
 *
 * Every state below is synthetic. See `./fixtures.ts`.
 */
const meta = {
  title: "DatasetPermissions/DatasetAccessView",
  component: DatasetAccessView,
  parameters: { layout: "fullscreen" },
  args: baseProps(),
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center bg-black/60 p-4">
        <div className="flex h-[744px] max-h-[90vh] w-full max-w-[960px] flex-col rounded-lg bg-white shadow-[0px_4px_10px_0px_rgba(29,41,61,0.1)]">
          <div className="flex h-[72px] items-center border-b border-slate-200 px-6">
            <h2 className="flex-1 truncate text-H6-18-semibold text-slate-850">
              {DATASET_NAME}
            </h2>
          </div>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof DatasetAccessView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything read, everything permitted: the widest case. */
export const KnownGrants: Story = {};

export const Loading: Story = {
  args: baseProps({ reads: { status: "loading" } }),
};

/**
 * The state an ordinary manager is expected to land in: they may grant, but
 * the recipient lookup is a global-only permission they do not hold. This
 * evidence selects the **grant-only form**.
 */
export const RecipientsNotSupported: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: DISCOVERED_GROUPS },
      recipients: { kind: "unknown", reason: "not-supported" },
    },
    capabilities: RECIPIENTS_UNSUPPORTED,
  }),
};

/** The grant form after several of this caller's changes, newest first. */
export const GrantOnlyResults: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: DISCOVERED_GROUPS },
      recipients: { kind: "unknown", reason: "not-supported" },
    },
    capabilities: RECIPIENTS_UNSUPPORTED,
    operations: [
      operation({
        operationId: "a",
        role: DATASET_ROLE_MAP.browse,
        status: "acknowledged",
      }),
      operation({
        operationId: "b",
        role: DATASET_ROLE_MAP.search,
        status: "refused",
      }),
      operation({
        operationId: "c",
        role: DATASET_ROLE_MAP.download,
        status: "uncertain",
        restored: true,
      }),
    ],
  }),
};

/** Grant-only while Everyone is ambiguous: candidates disabled, explained once. */
export const GrantOnlyAmbiguousAudience: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: AMBIGUOUS_GROUPS },
      recipients: { kind: "unknown", reason: "not-supported" },
    },
    capabilities: RECIPIENTS_UNSUPPORTED,
    everyone: EVERYONE_AMBIGUOUS,
  }),
};

export const RecipientReadFailed: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: DISCOVERED_GROUPS },
      recipients: { kind: "failed" },
    },
  }),
};

export const GroupDiscoveryFailed: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "failed" },
      recipients: { kind: "known", grants: [] },
    },
  }),
};

/** A complete read that found no groups this caller can see. */
export const NoGroupsVisible: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: [] },
      recipients: { kind: "known", grants: [] },
    },
  }),
};

/** Read-only: both write capabilities came back as explicit refusals. */
export const CapabilitiesRefused: Story = {
  args: baseProps({ capabilities: READ_ONLY_CAPABILITIES }),
};

/** Nothing could be established — which is not the same as a refusal. */
export const CapabilitiesUnknown: Story = {
  args: baseProps({ capabilities: UNKNOWN_CAPABILITIES }),
};

/** No record can be stored, so no change may be sent. */
export const JournalUnavailable: Story = {
  args: baseProps({ storageAvailable: false }),
};

export const WriteInFlight: Story = {
  args: baseProps({
    operations: [operation({ role: DATASET_ROLE_MAP.edit, status: "pending" })],
  }),
};

/**
 * The mixed state the spec names: one change acknowledged, one refused and one
 * whose outcome is unknown. The acknowledged one stays acknowledged.
 */
export const MixedOutcomes: Story = {
  args: baseProps({
    capabilities: ALL_ALLOWED,
    operations: [
      operation({
        operationId: "a",
        role: DATASET_ROLE_MAP.edit,
        status: "acknowledged",
        httpStatus: 204,
      }),
      operation({
        operationId: "b",
        role: DATASET_ROLE_MAP.manage,
        status: "refused",
        httpStatus: 403,
      }),
      operation({
        operationId: "c",
        role: DATASET_ROLE_MAP.search,
        status: "uncertain",
        uncertainReason: "no-response",
      }),
    ],
  }),
};

/** An operation restored from the journal after a reload. Still unknown. */
export const RestoredUncertainOperation: Story = {
  args: baseProps({
    operations: [
      operation({
        role: DATASET_ROLE_MAP.download,
        action: "remove",
        status: "uncertain",
        restored: true,
      }),
    ],
  }),
};

/**
 * Two groups carry the Everyone semantic, so none is treated as public and
 * neither accepts a new assignment — but the ordinary rows still work.
 */
export const PublicAudienceAmbiguous: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: AMBIGUOUS_GROUPS },
      recipients: { kind: "known", grants: [...KNOWN_GRANTS] },
    },
    everyone: EVERYONE_AMBIGUOUS,
  }),
};

/**
 * A refusal from a caller whose lookup capability was established as allowed.
 * One refused response is not a policy, so no limited form appears.
 */
export const RecipientReadRefusedUnexpectedly: Story = {
  args: baseProps({
    reads: {
      status: "settled",
      groups: { kind: "read", groups: DISCOVERED_GROUPS },
      recipients: { kind: "unknown", reason: "not-supported" },
    },
    capabilities: ALL_ALLOWED,
  }),
};

/** A re-check after an acknowledged change that did not complete. Nothing moves. */
export const ReconciliationFailed: Story = {
  args: baseProps({
    reconciliationFailed: true,
    operations: [
      operation({
        role: DATASET_ROLE_MAP.edit,
        status: "acknowledged",
        httpStatus: 200,
      }),
    ],
  }),
};
