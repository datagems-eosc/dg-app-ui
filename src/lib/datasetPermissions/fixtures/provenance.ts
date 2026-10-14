/**
 * Fixture provenance for dataset permissions.
 *
 * Every fixture in this directory is **synthetic**. None is a capture of a live
 * Gateway response: no authenticated request has been made against any DataGEMS
 * environment for this module. They are hand-built to the shape of the
 * inspected source at the revisions below, which is a contract *proposal*, not
 * deployment evidence. Identifiers are fabricated UUIDs.
 *
 * The fixtures are split into two files whose names are the claim each one
 * makes, because conflating them is how a synthetic fixture becomes an argument
 * that something works:
 *
 *  - `current.ts` — shaped from endpoints that **exist at this revision** and
 *    are reachable today. These are the shapes an administrator's read and an
 *    ordinary manager's refusal would take. Still synthetic.
 *  - `candidate.ts` — shaped from the **candidate capability combination**: a
 *    global permission read OR a dataset-scoped projection authorizing grant
 *    and revoke. Source-supported inference from `AuthorizationService`, not a
 *    partner answer and not a deployed observation. PM-05 owns confirming it.
 *
 * The former `proposed.ts` held a hypothetical manager-readable recipient
 * contract. Gateway #98 supplied a real one, so — as that file required — its
 * shapes were replaced by the dataset-scoped fixtures in `current.ts` rather
 * than kept beside them.
 */

export const FIXTURE_PROVENANCE = {
  kind: "synthetic",
  /** dg-app-api, branch `main`. */
  gatewaySourceRevision: "8988a7e879a2239b85dcb4a7f4ce932e368674fd",
  /**
   * dg-app-api `origin/main` fetched 14 October 2026, for the dataset-scoped
   * recipient read added by Gateway #98 and its `LookupDatasetContextGrants`
   * policy. Source only; the deployed revision is unverified.
   */
  recipientReadSourceRevision: "71fb7dfa474041cede287a9733d3d14a3b5fabc0",
  /** dg-app-ui, the accepted PM-01 base on `feat/321-dataset-group-access`. */
  uiBaseRevision: "34ba8eeaeb61872b7c046b7b700a40da9b77b28d",
  /** Where each permission and role spelling comes from. */
  sources: {
    permissionNames: "src/DataGEMS.Gateway.App/Authorization/Permission.cs",
    datasetProjection:
      "src/DataGEMS.Gateway.App/Model/Builder/DatasetBuilder.cs",
    projectionReduction: "src/DataGEMS.Gateway.App/Common/Extensions.cs",
    accountPermissions:
      "src/DataGEMS.Gateway.App/Model/Builder/AccountBuilder.cs",
    mutationControllers:
      "src/DataGEMS.Gateway.Api/Controllers/PrincipalController.cs",
    authorizationRule:
      "src/DataGEMS.Gateway.Api/Authorization/AuthorizationService.cs",
    recipientRead:
      "src/DataGEMS.Gateway.Api/Controllers/PrincipalController.cs (ContextGrantsDataset)",
    recipientReadPolicy:
      "src/DataGEMS.Gateway.Api/Configuration/permissions.json",
    recipientReadDto:
      "src/DataGEMS.Gateway.App/Common/Auth/DatasetContextGrants.cs",
    recipientGroupIds:
      "src/DataGEMS.Gateway.App/Service/AAI/AAIKeycloakService.cs (LookupDatasetContextGrants)",
  },
  /**
   * The Gateway lower-cases both the requested field names and the principal's
   * assigned permissions before intersecting them, so returned permission
   * arrays are lower case. Fixtures use that casing where they represent a
   * response and declared casing where they represent a request.
   */
  wire: {
    datasetPermissionCasing: "lower-case, per ReduceToAssignedPermissions",
    groupProjection: "project.fields: id, name, semantics",
    recipientRead:
      "List<{ datasetId, users, userGroups: { id, roles }[] }>; camelCase, nulls omitted",
  },
} as const;
