/**
 * Fixture provenance for dataset permissions.
 *
 * Every fixture in this directory is **synthetic**. None is a capture of a live
 * Gateway response: no authenticated request has been made against any DataGEMS
 * environment for this module. They are hand-built to the shape of the
 * inspected source at the revisions below, which is a contract *proposal*, not
 * deployment evidence. Identifiers are fabricated UUIDs.
 *
 * The fixtures are split into three files whose names are the claim each one
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
 *  - `proposed.ts` — shapes for a manager-readable recipient contract that
 *    **does not exist**. No endpoint serves these. They exist so the model and
 *    view can be exercised against a hypothetical without anybody inventing a
 *    URL for it, and nothing may be built against them.
 */

export const FIXTURE_PROVENANCE = {
  kind: "synthetic",
  /** dg-app-api, branch `main`. */
  gatewaySourceRevision: "8988a7e879a2239b85dcb4a7f4ce932e368674fd",
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
    recipientRead: "Dictionary<datasetId, roleNames>; ids absent when empty",
  },
} as const;
