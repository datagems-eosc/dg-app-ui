/**
 * Fixture provenance.
 *
 * Every fixture in this directory is **synthetic**. None is a capture of a live
 * Gateway response: no authenticated request has been made against any
 * DataGEMS environment for this module. They are hand-built to the shape of the
 * inspected source at the revisions below, which is a contract *proposal*, not
 * deployment evidence.
 *
 * Identifiers are fabricated UUIDs except where noted. The configuration step
 * identifiers and task ids are copied verbatim from the checked-in Gateway
 * default configuration so that the enum spaces and ordering under test match a
 * real file rather than an invented one.
 */

export const FIXTURE_PROVENANCE = {
  kind: "synthetic",
  /** dg-app-api, branch `main`. */
  gatewaySourceRevision: "8988a7e879a2239b85dcb4a7f4ce932e368674fd",
  /** dg-app-ui, branch `feat/333-dataset-onboarding-workflow`. */
  uiBaseRevision: "80d639660a06429f690f2dc87c5c38bcc85014a2",
  /** The file the configuration fixtures are shaped from. */
  configurationSource:
    "src/DataGEMS.Gateway.Api/Configuration/workflow-process.json",
  /**
   * Which enum each `kind` field belongs to. Conflating these is the trap this
   * module is built to avoid.
   */
  kindEnums: {
    configurationItem: "WorkflowProcessKind (0-5)",
    configurationStep: "WorkflowDefinitionKind (0-10, test variants 6-10)",
    processInstanceStep: "none - steps carry no kind; join by stepId",
  },
  statusEnum:
    "WorkflowProcessStatus: 0 InProgress, 1 Failed, 2 Succeeded, 3 Pending",
  /**
   * Wire conventions taken from the source and from existing working UI calls,
   * not from a live observation of this endpoint.
   */
  wire: {
    casing: "camelCase",
    absentProperties:
      "omitted entirely (Startup.cs NullValueHandling.Ignore); explicit null is a defensive robustness case only",
    projection: "repeated f= query parameters",
  },
  observedLive: false,
} as const;
