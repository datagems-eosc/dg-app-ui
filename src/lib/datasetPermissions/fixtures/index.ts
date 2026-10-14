/**
 * Synthetic fixtures for the dataset group-access contract.
 *
 * Development and test use only. Nothing here was captured from a live
 * environment — read `./provenance.ts` before treating any of it as evidence of
 * deployed behaviour, and keep the two claims apart: `current` shapes exist in
 * source, `candidate` shapes encode an unconfirmed inference.
 */

export {
  candidateAsymmetricEvidence,
  candidateContextOnlyEvidence,
  candidateGlobalOnlyEvidence,
  candidateIncompleteEvidence,
} from "./candidate";
export {
  ambiguousEveryoneGroupQueryPayload,
  currentAdminAccountPayload,
  currentGroupQueryPayload,
  currentManagerAccountPayload,
  DATASET_ID,
  datasetActionsAbsentPayload,
  datasetActionsDeniedPayload,
  datasetActionsGrantedPayload,
  datasetGrantsEmptyPayload,
  datasetGrantsPayload,
  datasetGrantsUndiscoveredHolderPayload,
  datasetGrantsUnknownRolePayload,
  datasetGrantsUnusablePayloads,
  datasetManagerActionsPayload,
  deniedRecipientReadStatus,
  detailsPageDatasetPayload,
  EVERYONE_GROUP_ID,
  groupQueryWithoutSemanticsPayload,
  INDIVIDUAL_USER_ID,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "./current";
export { FIXTURE_PROVENANCE } from "./provenance";
