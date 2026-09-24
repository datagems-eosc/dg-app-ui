/**
 * Synthetic fixtures for the dataset group-access contract.
 *
 * Development and test use only. Nothing here was captured from a live
 * environment — read `./provenance.ts` before treating any of it as evidence of
 * deployed behaviour, and keep the three claims apart: `current` shapes exist,
 * `candidate` shapes encode an unconfirmed inference, `proposed` shapes have no
 * endpoint at all.
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
  currentAdminGroupGrantsEmptyPayload,
  currentAdminGroupGrantsPayload,
  currentGroupQueryPayload,
  currentManagerAccountPayload,
  DATASET_ID,
  datasetActionsAbsentPayload,
  datasetActionsDeniedPayload,
  datasetActionsGrantedPayload,
  deniedManagerRecipientReadStatus,
  detailsPageDatasetPayload,
  EVERYONE_GROUP_ID,
  groupQueryWithoutSemanticsPayload,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
} from "./current";
export {
  proposedManagerRecipientGrants,
  proposedManagerRecipientGrantsWithoutEveryone,
} from "./proposed";
export { FIXTURE_PROVENANCE } from "./provenance";
