"use client";

/**
 * Dataset group access — the view.
 *
 * A presentation for the existing `ui/user/DatasetPermissionsModal` body and
 * footer: same dataset title bar, same group list, same permission vocabulary,
 * different promises. What changes, and why:
 *
 *  - **no Save/Cancel.** The old footer implied a transaction that never
 *    existed; every switch already sent its request immediately. Done closes;
 *  - **no bulk "Revoke Access".** It fired one request per held role and
 *    removed the row, which looks like a guarantee that the group can no longer
 *    reach the dataset. Removal is now one explicit role at a time;
 *  - **no switches without a read.** The old grid rendered every unknown role
 *    as an off switch. A denied or failed recipient read now renders an
 *    explanation and no controls at all;
 *  - **one write at a time for this dataset**, per design section 3, rather
 *    than per assignment.
 *
 * This component owns search and the confirmation dialog, and nothing else. It
 * holds no permission or operation state: `useDatasetPermissions` owns that,
 * `lib/datasetPermissions/model` owns the decisions, and everything on screen
 * is derived from the props on the current render.
 *
 * `DatasetGroupAccess` mounts it inside `ui/user/DatasetPermissionsModal`,
 * from both entry points, while the `datasetGroupAccess` flag is on.
 */

import { Button } from "@ui/Button";
import { ConfirmationModal } from "@ui/ConfirmationModal";
import { Input } from "@ui/Input";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { DatasetRoleOperationState } from "@/hooks/useDatasetPermissions";
import type { DatasetRoleAction } from "@/lib/datasetPermissions/types";
import { cn } from "@/lib/utils";
import {
  ACCESS_UNAVAILABLE_TITLE,
  AMBIGUOUS_AUDIENCE_BADGE,
  accessUnavailableMessage,
  capabilityMessage,
  confirmationCopy,
  DATASET_BUSY_MESSAGE,
  DISCOVERY_CAVEAT,
  DONE_LABEL,
  EMPTY_DISCOVERY_MESSAGE,
  everyoneUnavailableMessage,
  GRANT_RESULTS_POINTER,
  grantResultText,
  groupsUnavailableMessage,
  LOADING_MESSAGE,
  noSearchMatchesMessage,
  PUBLIC_AUDIENCE_BADGE,
  RECONCILIATION_FAILED_MESSAGE,
  rowFeedbackText,
  SEARCH_PLACEHOLDER,
  STORAGE_UNAVAILABLE_MESSAGE,
  STORAGE_UNAVAILABLE_TITLE,
  uncertainNoticeMessage,
  unlistedGroupLabel,
  VIEW_INTRO,
} from "./copy";
import { GrantOnlyForm, type GrantResult } from "./GrantOnlyForm";
import { OperationFeedback } from "./OperationFeedback";
import {
  activityOf,
  audienceOf,
  buildAccessRows,
  buildGrantTargets,
  GRANT_ROLE_OPTIONS,
  groupLabel,
  hasPendingWrite,
  latestOperationFor,
  roleLabelOf,
  uncertainOperations,
} from "./rows";
import type {
  ControlBlock,
  DatasetAccessViewProps,
  GroupAccessRow,
  PendingConfirmation,
  RoleActivity,
  RoleCell,
} from "./types";

type NoticeTone = "info" | "warning" | "error";

interface Notice {
  readonly id: string;
  readonly tone: NoticeTone;
  /** Optional bold lead, for a notice whose first sentence is the headline. */
  readonly title?: string;
  readonly text: string;
  /** Detail lines, for uncertain changes whose group row is not on screen. */
  readonly details?: readonly string[];
}

/**
 * Type-scale classes are joined *outside* `cn()`.
 *
 * `cn` is `twMerge(clsx(...))`, and this project's type scale is spelled
 * `text-body-14-regular`, `text-descriptions-12-regular` and so on. To
 * tailwind-merge those look like `text-<colour>` utilities, so a colour class
 * in the same call silently removes the size: `twMerge("text-descriptions-12-regular
 * text-gray-750")` returns just `text-gray-750`. Keeping the scale out of the
 * merged string is what makes a notice render at 12px instead of inheriting.
 */
const withScale = (scale: string, rest: string): string => `${scale} ${rest}`;

const NOTICE_STYLE: Record<NoticeTone, string> = {
  info: "border-slate-200 bg-slate-50 text-gray-750",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

type ShownActivity = Exclude<RoleActivity, { readonly kind: "idle" }>;

/** A recorded operation always has an outcome to show; never idle. */
const shownActivity = (operation: DatasetRoleOperationState): ShownActivity => {
  const activity = activityOf(operation);
  return activity.kind === "idle"
    ? {
        kind: "uncertain",
        action: operation.action,
        restored: operation.restored,
      }
    : activity;
};

/**
 * The role control.
 *
 * `role="switch"` rather than the existing modal's `aria-pressed` button: this
 * is an on/off state that takes effect immediately, which is what a switch is,
 * and it gives the control a state a screen reader announces without the user
 * having to infer it from a toggle button's pressed-ness.
 */
function RoleSwitch({
  checked,
  disabled,
  label,
  describedBy,
  attention,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  describedBy: string | undefined;
  /** A compact marker for a change we couldn't confirm; the text explains it. */
  attention: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-4 w-7 shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1",
        checked ? "justify-end bg-sky-950" : "justify-start bg-slate-200",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        attention && "ring-2 ring-amber-500 ring-offset-1",
      )}
    >
      <span className="h-3 w-3 rounded-full bg-white shadow-[0px_0.6px_0.6px_0px_rgba(213,218,227,0.3)]" />
    </button>
  );
}

export function DatasetAccessView({
  datasetName,
  mode,
  scopeKey,
  reads,
  capabilities,
  everyone,
  operations,
  storageAvailable,
  reconciliationFailed = false,
  canAttempt,
  onRoleChange,
  onDone,
}: DatasetAccessViewProps) {
  const baseId = useId();
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null,
  );

  // Owner *and* capability changes invalidate an unconfirmed dialog, on the
  // render that changes them rather than in a later effect. A confirmation
  // raised for one principal, Gateway, dataset or authority must not survive
  // into a state where it would mean something else.
  const ownerKey = `${scopeKey}|${capabilities.grant}|${capabilities.revoke}|${capabilities.lookupRecipients}`;
  const [confirmationOwner, setConfirmationOwner] = useState(ownerKey);
  let activeConfirmation = confirmation;
  if (confirmationOwner !== ownerKey) {
    setConfirmationOwner(ownerKey);
    setConfirmation(null);
    activeConfirmation = null;
  }

  const settled = reads.status === "settled" ? reads : null;
  const discoveredGroups =
    settled !== null && settled.groups.kind === "read"
      ? settled.groups.groups
      : null;
  const everyoneGroupId =
    everyone.kind === "identified" ? everyone.group.id : null;

  const rows = useMemo(
    () =>
      settled === null || discoveredGroups === null
        ? null
        : buildAccessRows({
            groups: discoveredGroups,
            recipients: settled.recipients,
            operations,
            everyoneGroupId,
          }),
    [settled, discoveredGroups, operations, everyoneGroupId],
  );

  const query = search.trim().toLowerCase();
  const visibleRows = useMemo(
    () =>
      rows === null || query === ""
        ? rows
        : rows.filter((row) => row.name.toLowerCase().includes(query)),
    [rows, query],
  );

  const busy = hasPendingWrite(operations);
  const uncertain = uncertainOperations(operations);

  /**
   * A name for the group an operation concerns, even when the current
   * discovery omits it: a restored unknown outcome must stay intelligible.
   */
  const groupNameOf = (groupId: string): string => {
    const group = discoveredGroups?.find(
      (candidate) => candidate.id === groupId,
    );
    return group === undefined
      ? unlistedGroupLabel(groupId)
      : groupLabel(group);
  };

  /**
   * Notices, chosen for the presentation on screen rather than accumulated.
   *
   * Each fact appears once, where it affects the task: a capability banner
   * only in the full editor, where both actions exist; the Everyone
   * explanation beside the grant chooser rather than above it; a busy dataset
   * through the pending change's own feedback in the grant form. Loading and
   * unavailable states explain themselves in their body.
   */
  const notices: Notice[] = [];
  const addNotice = (
    notice: Omit<Notice, "text"> & { text: string | null },
  ) => {
    if (notice.text !== null) notices.push({ ...notice, text: notice.text });
  };

  const editing = mode.kind === "full-editor" || mode.kind === "grant-only";

  if (editing && !storageAvailable) {
    addNotice({
      id: "storage",
      tone: "error",
      title: STORAGE_UNAVAILABLE_TITLE,
      text: STORAGE_UNAVAILABLE_MESSAGE,
    });
  }
  if (mode.kind === "full-editor") {
    if (reconciliationFailed) {
      // A warning, not an error: nothing failed except our attempt to look
      // again. Every acknowledged change is still acknowledged.
      addNotice({
        id: "reconciliation",
        tone: "warning",
        text: RECONCILIATION_FAILED_MESSAGE,
      });
    }
    if (settled !== null) {
      addNotice({
        id: "groups",
        tone: settled.groups.kind === "failed" ? "error" : "warning",
        text: groupsUnavailableMessage(settled.groups),
      });
    }
    if (
      everyone.kind === "unavailable" &&
      everyone.reason === "multiple-matches"
    ) {
      addNotice({
        id: "everyone",
        tone: "info",
        text: everyoneUnavailableMessage(everyone),
      });
    }
    addNotice({
      id: "grant-capability",
      tone: "warning",
      text: capabilityMessage("assign", capabilities.grant),
    });
    addNotice({
      id: "revoke-capability",
      tone: "warning",
      text: capabilityMessage("remove", capabilities.revoke),
    });
    if (uncertain.length > 0) {
      // The detail sits with each group's row. A change whose row is not on
      // screen — filtered out, or outside the current discovery — is named
      // here instead, so it never disappears from view.
      const shown = new Set(visibleRows?.map((row) => row.groupId) ?? []);
      addNotice({
        id: "uncertain",
        tone: "warning",
        text: uncertainNoticeMessage(uncertain.length),
        details: uncertain
          .filter((op) => !shown.has(op.groupId))
          .map(
            (op) =>
              `${groupNameOf(op.groupId)}: ${rowFeedbackText(
                shownActivity(op),
                roleLabelOf(op.role),
              )}`,
          ),
      });
    }
    if (busy) {
      addNotice({ id: "busy", tone: "info", text: DATASET_BUSY_MESSAGE });
    }
  }
  if (mode.kind === "grant-only" && uncertain.length > 0) {
    // On reopen the named result sits below the form; this line at the top
    // keeps an unresolved change from going unnoticed.
    addNotice({
      id: "uncertain",
      tone: "warning",
      text: `${uncertainNoticeMessage(uncertain.length)} ${GRANT_RESULTS_POINTER}`,
    });
  }

  /**
   * Why this control is not offered, in the order the reasons matter.
   *
   * The cell's own activity comes first so a pending or uncertain switch
   * explains itself rather than reporting the dataset-wide reason, and the
   * capability check comes before the dataset-busy one so "you may not do this
   * at all" is never softened into "not just now".
   */
  const blockFor = (
    row: GroupAccessRow,
    cell: RoleCell,
  ): ControlBlock | null => {
    if (cell.activity.kind === "pending") return "in-flight";
    if (cell.activity.kind === "uncertain") return "uncertain-outcome";
    if (!storageAvailable) return "storage-unavailable";

    const action: DatasetRoleAction = cell.granted ? "remove" : "assign";
    const decision =
      action === "assign" ? capabilities.grant : capabilities.revoke;
    if (decision !== "allowed") {
      return decision === "not-permitted"
        ? "not-permitted"
        : "capability-unknown";
    }

    // A possible public audience is never granted to as an ordinary group.
    // Removing a known role stays available under its exact confirmation.
    if (action === "assign" && row.ambiguousAudience) {
      return "ambiguous-audience";
    }

    // Design section 3: a write in flight prevents *another dataset action*,
    // not merely another action on the same assignment.
    if (busy) return "dataset-busy";

    const attempt = canAttempt(row.groupId, cell.role, action);
    return attempt.kind === "blocked" ? attempt.reason : null;
  };

  /**
   * The same question for the grant-only form, before anything is chosen.
   *
   * It reuses the reasons and the order above rather than inventing a
   * parallel rule: the two presentations share one operation lifecycle. The
   * per-assignment answer is {@link selectionBlock}.
   */
  const grantBlock = ((): ControlBlock | null => {
    if (!storageAvailable) return "storage-unavailable";
    if (capabilities.grant !== "allowed") {
      return capabilities.grant === "not-permitted"
        ? "not-permitted"
        : "capability-unknown";
    }
    if (busy) return "dataset-busy";
    return null;
  })();

  const grantTargets = useMemo(
    () =>
      discoveredGroups === null
        ? []
        : buildGrantTargets(discoveredGroups, everyoneGroupId),
    [discoveredGroups, everyoneGroupId],
  );

  /**
   * The group's audience on *this* render, for the dispatch re-check. A group
   * missing from the current discovery is refused, like an ambiguous one.
   */
  const audienceOfGroup = (groupId: string) => {
    const group = discoveredGroups?.find(
      (candidate) => candidate.id === groupId,
    );
    return group === undefined
      ? "ambiguous-public"
      : audienceOf(group, everyoneGroupId);
  };

  /**
   * Whether the chosen group and permission may be granted right now.
   *
   * Asked while rendering, so the form can explain a blocked choice and
   * disable its button instead of accepting a click that sends nothing. The
   * operation lifecycle's `canAttempt` is the authority; the recorded
   * operation is consulted first only so an unknown outcome on this exact
   * assignment is reported as such, whatever order the hook checks in.
   */
  const selectionBlock = (
    groupId: string,
    role: string,
  ): ControlBlock | null => {
    const target = grantTargets.find(
      (candidate) => candidate.groupId === groupId,
    );
    if (target === undefined || target.ambiguousAudience) {
      return "ambiguous-audience";
    }
    const latest = latestOperationFor(operations, groupId, role);
    if (latest?.status === "uncertain") return "uncertain-outcome";
    if (latest?.status === "pending") return "in-flight";
    if (grantBlock !== null) return grantBlock;
    const attempt = canAttempt(groupId, role, "assign");
    return attempt.kind === "blocked" ? attempt.reason : null;
  };

  /**
   * This caller's changes, newest first, named by group and permission. Taken
   * from the shared operation list, so a restored unknown outcome is here on
   * reopen even when discovery no longer lists its group.
   */
  const grantResults: readonly GrantResult[] = [...operations]
    .reverse()
    .map((op) => {
      const activity = shownActivity(op);
      return {
        id: op.operationId,
        tone: activity.kind,
        text: grantResultText(
          activity,
          roleLabelOf(op.role),
          groupNameOf(op.groupId),
        ),
      };
    });

  /**
   * One grant from the grant-only form.
   *
   * Confirmed on exactly the same terms as the editor: an elevated role or the
   * public audience raises the dialog, an ordinary role does not — the group
   * and role were each chosen explicitly and a submit button was pressed. The
   * form has already disabled a blocked choice; the checks here are the guard
   * behind that, never the explanation.
   */
  const requestGrant = (targetGroupId: string, role: string) => {
    if (selectionBlock(targetGroupId, role) !== null) return;
    const target = grantTargets.find(
      (candidate) => candidate.groupId === targetGroupId,
    );
    const option = GRANT_ROLE_OPTIONS.find(
      (candidate) => candidate.role === role,
    );
    if (target === undefined || option === undefined) return;

    if (option.elevated || target.publicAudience) {
      setConfirmation({
        groupId: target.groupId,
        groupName: target.name,
        publicAudience: target.publicAudience,
        roleKey: option.key,
        role: option.role,
        roleLabel: option.label,
        action: "assign",
      });
      return;
    }

    onRoleChange(target.groupId, option.role, "assign");
  };

  const requestChange = (row: GroupAccessRow, cell: RoleCell) => {
    if (blockFor(row, cell) !== null) return;
    const action: DatasetRoleAction = cell.granted ? "remove" : "assign";

    // Removal, an elevated role and the public audience are each confirmed.
    // Everything else is a deliberate click on a labelled control and goes
    // straight out, because a dialog on every toggle teaches people to dismiss
    // dialogs.
    if (action === "remove" || cell.elevated || row.publicAudience) {
      setConfirmation({
        groupId: row.groupId,
        groupName: row.name,
        publicAudience: row.publicAudience,
        roleKey: cell.key,
        role: cell.role,
        roleLabel: cell.label,
        action,
      });
      return;
    }

    onRoleChange(row.groupId, cell.role, action);
  };

  /**
   * Dispatch from the dialog re-checks everything.
   *
   * The dialog was raised against the evidence of an earlier render. Between
   * then and now a read may have completed, a capability may have changed and
   * another write may have started, so the decision is taken again here and the
   * dialog's own record of it is not trusted.
   */
  const confirmChange = () => {
    const pending = activeConfirmation;
    setConfirmation(null);
    if (pending === null) return;
    if (!storageAvailable || busy) return;

    const decision =
      pending.action === "assign" ? capabilities.grant : capabilities.revoke;
    if (decision !== "allowed") return;
    // Discovery may have changed since the dialog opened; a group that is now
    // an ambiguous audience (or gone) receives no new assignment.
    if (
      pending.action === "assign" &&
      audienceOfGroup(pending.groupId) === "ambiguous-public"
    ) {
      return;
    }
    if (
      canAttempt(pending.groupId, pending.role, pending.action).kind ===
      "blocked"
    ) {
      return;
    }

    onRoleChange(pending.groupId, pending.role, pending.action);
  };

  const closeView = () => {
    setConfirmation(null);
    onDone();
  };

  const confirmCopy =
    activeConfirmation === null
      ? null
      : confirmationCopy({
          datasetName,
          groupName: activeConfirmation.groupName,
          roleKey: activeConfirmation.roleKey,
          roleLabel: activeConfirmation.roleLabel,
          action: activeConfirmation.action,
          publicAudience: activeConfirmation.publicAudience,
        });

  const unavailableText =
    mode.kind !== "unavailable"
      ? null
      : mode.reason === "no-usable-groups" &&
          settled !== null &&
          settled.groups.kind !== "read"
        ? // No group to grant to *because the groups could not be read*: say
          // that, rather than implying the account has none.
          groupsUnavailableMessage(settled.groups)
        : accessUnavailableMessage(mode.reason);

  const audienceNote =
    everyone.kind === "unavailable" && everyone.reason !== "multiple-matches"
      ? everyoneUnavailableMessage(everyone)
      : null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-label={`Group access for ${datasetName}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 sm:px-6">
        {mode.kind === "full-editor" && (
          <p className="text-body-14-regular text-gray-650">{VIEW_INTRO}</p>
        )}

        {notices.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {notices.map((notice) => (
              <div
                key={notice.id}
                role={notice.tone === "error" ? "alert" : "status"}
                className={withScale(
                  "text-body-14-regular",
                  cn("rounded-lg border px-3 py-2", NOTICE_STYLE[notice.tone]),
                )}
              >
                {notice.title !== undefined && (
                  <p className="text-body-14-medium">{notice.title}</p>
                )}
                <p>{notice.text}</p>
                {notice.details !== undefined && notice.details.length > 0 && (
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                    {notice.details.map((detail) => (
                      <li key={detail} className="break-words">
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {mode.kind === "loading" && (
          <p role="status" className="mt-2 text-body-14-regular text-gray-650">
            {LOADING_MESSAGE}
          </p>
        )}

        {mode.kind === "unavailable" && (
          <div className="mt-2">
            <h3 className="text-body-16-semibold text-slate-850">
              {ACCESS_UNAVAILABLE_TITLE}
            </h3>
            <p
              role="status"
              className="mt-2 text-body-14-regular text-gray-650"
            >
              {unavailableText}
            </p>
          </div>
        )}

        {mode.kind === "grant-only" && (
          <GrantOnlyForm
            datasetName={datasetName}
            targets={grantTargets}
            roles={GRANT_ROLE_OPTIONS}
            block={grantBlock}
            selectionBlock={selectionBlock}
            audienceNote={audienceNote}
            results={grantResults}
            onGrant={requestGrant}
          />
        )}

        {mode.kind === "full-editor" && rows !== null && (
          <>
            <div className="mt-4">
              <Input
                name={`${baseId}-search`}
                aria-label="Search groups"
                placeholder={SEARCH_PLACEHOLDER}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                rightIcon={<Search className="h-4 w-4 text-icon" />}
                className="h-10"
              />
            </div>

            <div className="mt-6">
              <div className="flex items-end gap-2 pb-1">
                <h3 className="flex-1 text-body-16-semibold text-gray-750">
                  Group permissions
                </h3>
                <div className="hidden gap-1 sm:flex" aria-hidden="true">
                  {(rows[0]?.cells ?? []).map((cell) => (
                    <span
                      key={cell.key}
                      className="w-20 text-center text-descriptions-12-medium text-gray-750"
                    >
                      {cell.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="pb-2 text-descriptions-12-regular text-gray-650">
                {DISCOVERY_CAVEAT}
                {audienceNote !== null && ` ${audienceNote}`}
              </p>

              {rows.length === 0 && (
                <p
                  role="status"
                  className="border-t border-slate-200 py-6 text-body-14-regular text-gray-650"
                >
                  {EMPTY_DISCOVERY_MESSAGE}
                </p>
              )}

              {rows.length > 0 && visibleRows?.length === 0 && (
                <p
                  role="status"
                  className="border-t border-slate-200 py-6 text-body-14-regular text-gray-650"
                >
                  {noSearchMatchesMessage(search.trim())}
                </p>
              )}

              {visibleRows !== null && visibleRows.length > 0 && (
                <ul className="border-t border-b border-slate-200">
                  {visibleRows.map((row) => {
                    const feedback = row.cells.flatMap((cell) =>
                      cell.activity.kind === "idle"
                        ? []
                        : [
                            {
                              cell,
                              activity: cell.activity,
                              id: `${baseId}-${row.groupId}-${cell.key}`,
                            },
                          ],
                    );
                    return (
                      <li
                        key={row.groupId}
                        className="border-b border-slate-200 py-3 last:border-b-0"
                      >
                        {/*
                          The primary row: name and six switches, aligned on
                          the name's first line whatever else the row carries.
                          Feedback goes below it, never under a switch.
                        */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-body-14-medium break-words text-slate-850">
                              {row.name}
                            </span>
                            {row.publicAudience && (
                              <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-descriptions-12-medium text-amber-800">
                                {PUBLIC_AUDIENCE_BADGE}
                              </span>
                            )}
                            {row.ambiguousAudience && (
                              <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-descriptions-12-medium text-amber-800">
                                {AMBIGUOUS_AUDIENCE_BADGE}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:gap-1">
                            {row.cells.map((cell) => {
                              const block = blockFor(row, cell);
                              const statusId =
                                cell.activity.kind === "idle"
                                  ? undefined
                                  : `${baseId}-${row.groupId}-${cell.key}`;
                              return (
                                <div
                                  key={cell.key}
                                  className="flex items-center justify-between gap-2 sm:h-[21px] sm:w-20 sm:justify-center"
                                >
                                  <span className="text-descriptions-12-regular text-gray-650 sm:hidden">
                                    {cell.label}
                                  </span>
                                  <RoleSwitch
                                    checked={cell.granted}
                                    disabled={block !== null}
                                    label={`${row.name} — ${cell.label}`}
                                    describedBy={statusId}
                                    attention={
                                      cell.activity.kind === "uncertain"
                                    }
                                    onToggle={() => requestChange(row, cell)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {feedback.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {feedback.map(({ cell, activity, id }) => (
                              <OperationFeedback
                                key={cell.key}
                                id={id}
                                tone={activity.kind}
                                text={rowFeedbackText(activity, cell.label)}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/*
        Closing never undoes an applied change, and needs no disclaimer to say
        so. In the grant form it is secondary to the task's own action.
      */}
      <div className="flex justify-end border-t border-slate-200 px-4 py-4 sm:px-6">
        <Button
          variant={mode.kind === "grant-only" ? "outline" : "primary"}
          size="md"
          onClick={closeView}
          className="w-full rounded-full sm:w-[148px]"
        >
          {DONE_LABEL}
        </Button>
      </div>

      {confirmCopy !== null && (
        <ConfirmationModal
          isVisible
          onClose={() => setConfirmation(null)}
          onConfirm={confirmChange}
          title={confirmCopy.title}
          message1={confirmCopy.message1}
          message2={confirmCopy.message2}
          confirmText={confirmCopy.confirmText}
          cancelText="Cancel"
          confirmVariant={confirmCopy.confirmVariant}
          actionLayout="responsive"
        />
      )}
    </div>
  );
}
