"use client";

/**
 * Dataset group access — the grant-only form.
 *
 * The presentation for a caller the Gateway confirms may *give* a group access
 * to this dataset but may not *read* who already has it. That is the ordinary
 * manager's supported position at the pinned Gateway revision, not a broken
 * full editor: `ContextGrantsDatasetGroupOther` is gated on the global
 * `LookupContextGrantOther` permission, while granting is authorized by global
 * **or** affiliated context. `mode.selectAccessMode` is what decides that this
 * form is the right one; this component never infers it.
 *
 * It leads with the task — group, permission, Grant — and states the
 * limitation once. What it deliberately does not have, each because the
 * evidence cannot support it:
 *
 *  - **no switches.** A switch shows an on/off state. Existing access is
 *    unknown here, so every switch would be drawn off — which is the "nobody
 *    has access" claim the whole feature exists to avoid;
 *  - **no revoke.** Removing a role safely means knowing the role is held;
 *  - **no sharing summary.** Publication is decided from Everyone's grants,
 *    which is exactly what cannot be read here;
 *  - **no multi-select.** One deliberate action is one request, so Browse is
 *    never silently bundled with Download.
 *
 * Results come from the shared operation lifecycle, named by group and
 * permission. They acknowledge this caller's changes; they are not a list of
 * who has access.
 *
 * Design: the role list follows the composition of
 * `07-user-profile-permissions/DropDown Menu Permissions View.pdf` — a white
 * rounded card, one control and label per row, in that file's order. Two
 * deliberate adaptations: its checkboxes become **radios**, because exactly
 * one role is granted per action; and its "Select All" row is dropped, because
 * here it would be a bulk mutation. The submit control is the shared pill
 * `Button` from `18-shared-controls/Button.pdf`.
 */

import { Button } from "@ui/Button";
import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AMBIGUOUS_AUDIENCE_BADGE,
  AMBIGUOUS_CHOOSER_HINT,
  blockMessage,
  GRANT_GROUP_LABEL,
  GRANT_GROUP_PLACEHOLDER,
  GRANT_INCOMPLETE_MESSAGE,
  GRANT_ONLY_EXISTING_ACCESS,
  GRANT_ONLY_TITLE,
  GRANT_RESULTS_LABEL,
  GRANT_ROLE_LABEL,
  GRANT_SUBMIT_LABEL,
  grantOnlyIntro,
  PUBLIC_AUDIENCE_BADGE,
  PUBLIC_AUDIENCE_HINT,
  selectedGrantBlockMessage,
} from "./copy";
import { type FeedbackTone, OperationFeedback } from "./OperationFeedback";
import type { ControlBlock, GrantRoleOption, GrantTargetOption } from "./types";

/** One change's result, already worded by the view. Newest first. */
export interface GrantResult {
  readonly id: string;
  readonly tone: FeedbackTone;
  readonly text: string;
}

export interface GrantOnlyFormProps {
  readonly datasetName: string;
  readonly targets: readonly GrantTargetOption[];
  readonly roles: readonly GrantRoleOption[];
  /**
   * Why granting is not possible at all right now, or `null`. Computed by the
   * view from the same evidence the full editor uses, so the two presentations
   * cannot disagree about whether a write may be attempted.
   */
  readonly block: ControlBlock | null;
  /**
   * Why *this* group and permission cannot be granted right now, or `null`.
   * Asked before the user clicks, so a blocked choice is explained and its
   * button disabled rather than silently ignored. The view answers it from
   * the operation lifecycle's own `canAttempt`.
   */
  readonly selectionBlock: (
    groupId: string,
    role: string,
  ) => ControlBlock | null;
  /** A quiet note beside the chooser when Everyone is not offered, or `null`. */
  readonly audienceNote: string | null;
  readonly results: readonly GrantResult[];
  /**
   * Requests exactly one grant. The view decides whether it needs confirmation
   * first — elevated roles and the public audience do — and re-checks the
   * decision at dispatch, so nothing here is trusted as still valid.
   */
  readonly onGrant: (groupId: string, role: string) => void;
}

/**
 * Form-level blocks that are already explained elsewhere on screen: storage by
 * the view's error notice, a busy dataset by the pending result below.
 */
const EXPLAINED_ELSEWHERE: readonly ControlBlock[] = [
  "storage-unavailable",
  "dataset-busy",
];

export function GrantOnlyForm({
  datasetName,
  targets,
  roles,
  block,
  selectionBlock,
  audienceNote,
  results,
  onGrant,
}: GrantOnlyFormProps) {
  const baseId = useId();
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState("");

  const selectedTarget = targets.find((target) => target.groupId === groupId);
  const selectedRole = roles.find((option) => option.role === role);
  const incomplete = selectedTarget === undefined || selectedRole === undefined;
  const disabled = block !== null;
  // Ambiguous candidates are not offered, and are refused here too, however
  // their value reached the control; `selectionBlock` reports that.
  const chosenBlock =
    disabled || incomplete ? null : selectionBlock(groupId, role);
  const hasAmbiguous = targets.some((target) => target.ambiguousAudience);

  const note =
    block !== null
      ? EXPLAINED_ELSEWHERE.includes(block)
        ? null
        : blockMessage(block)
      : chosenBlock !== null && selectedTarget && selectedRole
        ? selectedGrantBlockMessage(
            chosenBlock,
            selectedRole.label,
            selectedTarget.name,
          )
        : incomplete
          ? GRANT_INCOMPLETE_MESSAGE
          : null;
  const noteId = `${baseId}-note`;

  /*
   * Bring a result into view when it changes after mount, so the outcome of a
   * click is never off-screen below the button — on a phone it otherwise is.
   * Not on mount: a restored result is pointed to by the view's summary, and
   * the page should not jump when the form opens.
   */
  const resultsRef = useRef<HTMLDivElement>(null);
  const newest =
    results[0] === undefined ? "" : `${results[0].id}:${results[0].tone}`;
  const mountedNewest = useRef(newest);
  useEffect(() => {
    if (newest === "" || newest === mountedNewest.current) return;
    mountedNewest.current = newest;
    resultsRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [newest]);

  /*
   * While a change is applying the form is disabled, and a disabled control
   * drops keyboard focus to the page. Keep it here, on the results that
   * describe the change, instead. When the form has just become blocked,
   * focus on something that merely *contains* it — the dialog a closed
   * confirmation handed focus back to because Grant could no longer take it —
   * counts as dropped too. A form that appears already blocked leaves such
   * focus alone: finishing a read is no reason to move anyone.
   */
  const sectionRef = useRef<HTMLElement>(null);
  const previousBlock = useRef(block);
  useEffect(() => {
    const becameBlocked = previousBlock.current === null;
    previousBlock.current = block;
    if (block === null) return;
    const section = sectionRef.current;
    if (section === null) return;
    const active = document.activeElement;
    if (
      active === null ||
      active === document.body ||
      section.contains(active) ||
      (becameBlocked && active.contains(section))
    ) {
      resultsRef.current?.focus();
    }
  }, [block]);
  const groupHintId = `${baseId}-group-hint`;

  const submit = () => {
    if (disabled || incomplete || chosenBlock !== null) return;
    onGrant(groupId, role);
  };

  return (
    <section
      ref={sectionRef}
      className="mt-2 flex flex-col gap-5"
      aria-labelledby={`${baseId}-title`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3
            id={`${baseId}-title`}
            className="text-body-16-semibold text-slate-850"
          >
            {GRANT_ONLY_TITLE}
          </h3>
          <p className="text-body-14-regular break-words text-gray-650">
            {grantOnlyIntro(datasetName)}
          </p>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-body-14-regular text-gray-750">
          <Info
            aria-hidden="true"
            strokeWidth={1.5}
            className="mt-[3px] h-4 w-4 shrink-0 text-icon"
          />
          <span>{GRANT_ONLY_EXISTING_ACCESS}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${baseId}-group`}
          className="text-body-14-medium text-gray-750"
        >
          {GRANT_GROUP_LABEL}
        </label>
        {/*
          A native select: the platform control is keyboard- and screen-reader-
          correct without a custom listbox. The shared `ui/Select` is a
          protected component outside this feature's paths.
        */}
        <select
          id={`${baseId}-group`}
          value={groupId}
          disabled={disabled}
          aria-describedby={
            hasAmbiguous || audienceNote !== null ? groupHintId : undefined
          }
          onChange={(event) => setGroupId(event.target.value)}
          // The type scale stays out of `cn`: tailwind-merge reads
          // `text-body-14-regular` as a colour utility and `text-slate-850`
          // would silently remove it. See `withScale` in `DatasetAccessView`.
          className={`text-body-14-regular ${cn(
            "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-850",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1",
            disabled && "cursor-not-allowed opacity-50",
          )}`}
        >
          <option value="">{GRANT_GROUP_PLACEHOLDER}</option>
          {targets.map((target) => (
            <option
              key={target.groupId}
              value={target.groupId}
              disabled={target.ambiguousAudience}
            >
              {target.publicAudience
                ? `${target.name} (${PUBLIC_AUDIENCE_BADGE})`
                : target.ambiguousAudience
                  ? `${target.name} (${AMBIGUOUS_AUDIENCE_BADGE.toLowerCase()})`
                  : target.name}
            </option>
          ))}
        </select>
        {(hasAmbiguous || audienceNote !== null) && (
          <p
            id={groupHintId}
            className="text-descriptions-12-regular text-gray-650"
          >
            {hasAmbiguous ? AMBIGUOUS_CHOOSER_HINT : audienceNote}
          </p>
        )}
        {selectedTarget?.publicAudience === true && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-14-regular text-amber-800">
            {PUBLIC_AUDIENCE_HINT}
          </p>
        )}
      </div>

      <fieldset
        className="flex flex-col gap-2 border-0 p-0"
        disabled={disabled}
      >
        <legend className="pb-2 text-body-14-medium text-gray-750">
          {GRANT_ROLE_LABEL}
        </legend>
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white py-1">
          {roles.map((option) => (
            <label
              key={option.key}
              htmlFor={`${baseId}-role-${option.key}`}
              className={cn(
                "flex items-center gap-3 px-4 py-1.5",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                id={`${baseId}-role-${option.key}`}
                type="radio"
                name={`${baseId}-role`}
                value={option.role}
                checked={role === option.role}
                disabled={disabled}
                onChange={() => setRole(option.role)}
                className="h-4 w-4 accent-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1"
              />
              <span className="text-body-14-regular text-slate-850">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={submit}
          disabled={disabled || incomplete || chosenBlock !== null}
          aria-describedby={note === null ? undefined : noteId}
          className="w-full whitespace-nowrap rounded-full sm:w-[180px]"
        >
          {GRANT_SUBMIT_LABEL}
        </Button>
        {note !== null && (
          <p
            id={noteId}
            className={
              chosenBlock === "uncertain-outcome"
                ? "text-body-14-regular text-amber-800"
                : "text-descriptions-12-regular text-gray-650"
            }
          >
            {note}
          </p>
        )}
      </div>

      {/*
        Always mounted, so a result that appears is announced. It lists this
        caller's changes only, newest first.
      */}
      <div
        ref={resultsRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="flex flex-col gap-2 focus:outline-none"
      >
        {results.length > 0 && (
          <>
            <h4 className="text-descriptions-12-medium text-gray-750">
              {GRANT_RESULTS_LABEL}
            </h4>
            <ul className="flex flex-col gap-2">
              {results.map((result) => (
                <OperationFeedback
                  key={result.id}
                  tone={result.tone}
                  text={result.text}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
