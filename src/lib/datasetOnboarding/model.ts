/**
 * Dataset onboarding — pure interpretation of a process snapshot.
 *
 * Everything here is a total function of its arguments: no fetching, no
 * timers, no storage, no React. Access and sharing are *inputs*, never derived
 * — the presence of a dataset id establishes neither readability nor
 * publication, and this module must not invent either.
 *
 * The orthogonal states (processing / connection / sharing / availability) are
 * kept separate on purpose: collapsing them into one `isLoading`/`success` pair
 * is what makes a UI claim a dataset is ready when only part of it is.
 */

import type {
  AccessEvidence,
  ConnectionState,
  Notice,
  NoticeCode,
  OnboardingConfig,
  OnboardingView,
  PermittedAction,
  ProcessingState,
  ProcessSnapshot,
  ProcessStatus,
  ProcessStepSnapshot,
  StageState,
  StageView,
  StepDefinitionId,
} from "./types";

const STATUS_TO_STAGE_STATE: Record<number, StageState> = {
  0: "running",
  1: "failed",
  2: "succeeded",
  3: "pending",
};

const stageStateOf = (status: ProcessStatus): StageState =>
  status.kind === "known" ? STATUS_TO_STAGE_STATE[status.code] : "unknown";

const processingStateOf = (status: ProcessStatus): ProcessingState => {
  if (status.kind === "unknown") return "unknown";
  switch (status.code) {
    case 0:
      return "running";
    case 1:
      return "failed";
    case 2:
      return "succeeded";
    case 3:
      return "pending";
  }
};

export interface BuildViewInput {
  /** `null` while the first read is still outstanding. */
  readonly snapshot: ProcessSnapshot | null;
  /** `null` when configuration could not be loaded; the aggregate still shows. */
  readonly config: OnboardingConfig | null;
  readonly access: AccessEvidence;
  readonly connection: ConnectionState;
}

const CONNECTION_NOTICE: Partial<Record<ConnectionState, NoticeCode>> = {
  stale: "connection-stale",
  unavailable: "connection-unavailable",
  forbidden: "connection-forbidden",
};

export const buildOnboardingView = ({
  snapshot,
  config,
  access,
  connection,
}: BuildViewInput): OnboardingView => {
  const notices: NoticeCode[] = [];
  const pushNotice = (code: NoticeCode) => {
    if (!notices.includes(code)) notices.push(code);
  };

  const connectionNotice = CONNECTION_NOTICE[connection];
  if (connectionNotice) pushNotice(connectionNotice);

  if (snapshot === null) {
    return {
      processing: "loading",
      stages: [],
      unmatchedSteps: [],
      stepDetailsAvailable: false,
      configurationMatched: false,
      notices: notices.map(toNotice),
      actions: [],
    };
  }

  // --- configuration join ------------------------------------------------
  // Match the process *definition* to a configuration item. Without that join
  // we cannot claim an order, so stages are not rendered as a sequence.
  const matchedItem =
    config === null || snapshot.processDefinitionId === undefined
      ? undefined
      : config.items.find(
          (item) => item.processDefinitionId === snapshot.processDefinitionId,
        );

  if (config === null) pushNotice("configuration-unavailable");
  else if (matchedItem === undefined) pushNotice("configuration-mismatch");

  // --- step index --------------------------------------------------------
  const stepDetailsAvailable = snapshot.steps !== undefined;
  const steps = snapshot.steps ?? [];
  const stepsByDefinition = new Map<StepDefinitionId, ProcessStepSnapshot>();
  for (const step of steps) {
    // A duplicate step definition is a mapping problem; keep the first and flag.
    if (stepsByDefinition.has(step.stepDefinitionId)) {
      pushNotice("configuration-duplicate");
      continue;
    }
    stepsByDefinition.set(step.stepDefinitionId, step);
  }

  // --- ordered stages ----------------------------------------------------
  let stages: StageView[] = [];
  const consumed = new Set<StepDefinitionId>();

  if (matchedItem !== undefined) {
    const seenDefinitions = new Set<StepDefinitionId>();
    const seenOrders = new Set<number>();
    for (const configStep of matchedItem.steps) {
      if (seenDefinitions.has(configStep.stepDefinitionId)) {
        pushNotice("configuration-duplicate");
      }
      seenDefinitions.add(configStep.stepDefinitionId);
      if (seenOrders.has(configStep.order))
        pushNotice("configuration-duplicate");
      seenOrders.add(configStep.order);
    }

    const ordered = [...matchedItem.steps].sort((a, b) => a.order - b.order);
    stages = ordered.map((configStep) => {
      const step = stepsByDefinition.get(configStep.stepDefinitionId);
      if (step !== undefined) consumed.add(configStep.stepDefinitionId);
      // No matching step means the stage was not reported. That is explicitly
      // not success, and not a fabricated pending either.
      const state: StageState =
        step === undefined ? "not-reported" : stageStateOf(step.status);
      return {
        stepDefinitionId: configStep.stepDefinitionId,
        order: configStep.order,
        kind: configStep.kind,
        state,
        ...(step === undefined
          ? {}
          : {
              stepInstanceId: step.stepInstanceId,
              statusCode: step.status.code,
            }),
      };
    });

    // A stage that is still Pending *after* a failure has not run. Earlier
    // successes stay successes: the whole run is not relabelled as failed.
    const firstFailureIndex = stages.findIndex(
      (stage) => stage.state === "failed",
    );
    if (firstFailureIndex >= 0) {
      stages = stages.map((stage, index) =>
        index > firstFailureIndex && stage.state === "pending"
          ? { ...stage, state: "not-run" }
          : stage,
      );
    }
  }

  // --- steps the configuration does not describe -------------------------
  // Shown separately, with no invented position in the sequence.
  const unmatchedSteps: StageView[] = steps
    .filter((step) => !consumed.has(step.stepDefinitionId))
    .map((step) => ({
      stepDefinitionId: step.stepDefinitionId,
      stepInstanceId: step.stepInstanceId,
      state: stageStateOf(step.status),
      statusCode: step.status.code,
    }));
  if (unmatchedSteps.length > 0) pushNotice("unmatched-steps");

  if (!stepDetailsAvailable) pushNotice("step-details-unavailable");

  // --- aggregate ---------------------------------------------------------
  let processing = processingStateOf(snapshot.status);
  if (processing === "unknown") pushNotice("status-unknown");

  // An aggregate success alongside an explicitly failed step is contradictory;
  // report the contradiction rather than picking the more optimistic reading.
  const hasFailedStep = steps.some(
    (step) => step.status.kind === "known" && step.status.code === 1,
  );
  if (processing === "succeeded" && hasFailedStep) {
    processing = "inconsistent";
    pushNotice("status-inconsistent");
  }

  // --- access, sharing, DMM ---------------------------------------------
  // DMM readiness never overwrites process state and never implies that all
  // preparation or every platform capability is complete.
  if (access.dmmReady === true && processing !== "succeeded") {
    pushNotice("dmm-ready-while-incomplete");
  }

  if (access.availability === "denied") pushNotice("availability-denied");

  const terminal =
    processing === "succeeded" ||
    processing === "failed" ||
    processing === "inconsistent";

  if (
    access.availability === "unknown" &&
    (processing === "succeeded" || processing === "inconsistent")
  ) {
    pushNotice("availability-unconfirmed");
  }

  // `not-requested` deliberately produces no notice at all. Under revision 5
  // this flow issues no grant, so an "unconfirmed sharing" warning would be an
  // invented task: there is nothing outstanding to reconcile. The silence is
  // equally not evidence — it says only that we asked for nothing, never that
  // the dataset is private, public or reachable by anyone in particular.
  if (access.sharing === "failed") pushNotice("sharing-failed");
  else if (access.sharing === "not-confirmed" && terminal) {
    pushNotice("sharing-unconfirmed");
  }

  // --- permitted actions -------------------------------------------------
  // "Check again" is always a read. There is no rerun, cancel or stage-start
  // action: those are administrative operations, not contributor recovery.
  const actions: PermittedAction[] = [{ code: "check-again" }];
  if (snapshot.datasetId !== undefined && access.availability === "readable") {
    actions.push({ code: "view-dataset", datasetId: snapshot.datasetId });
  }

  return {
    processing,
    aggregateStatus: snapshot.status,
    stages,
    unmatchedSteps,
    stepDetailsAvailable,
    configurationMatched: matchedItem !== undefined,
    notices: notices.map(toNotice),
    actions,
    ...(snapshot.datasetId === undefined
      ? {}
      : { datasetId: snapshot.datasetId }),
  };
};

const toNotice = (code: NoticeCode): Notice => ({ code });

export const hasNotice = (view: OnboardingView, code: NoticeCode): boolean =>
  view.notices.some((notice) => notice.code === code);

export const hasAction = (
  view: OnboardingView,
  code: PermittedAction["code"],
): boolean => view.actions.some((action) => action.code === code);
