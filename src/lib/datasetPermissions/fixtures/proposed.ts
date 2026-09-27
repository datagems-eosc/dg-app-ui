/**
 * Fixtures for a **proposed** manager-readable recipient contract.
 *
 * No endpoint serves any of this. At the pinned revision the only recipient
 * read is `ContextGrantsDatasetGroupOther`, gated on the global
 * `LookupContextGrantOther` permission, and there is no route that lists the
 * groups holding roles on a dataset. These shapes exist so the model and, later,
 * the view can be exercised against the full-editor case without anybody
 * inventing a URL to fetch them from.
 *
 * Rules for using this file:
 *
 *  - no adapter method may be written against these shapes;
 *  - no test may present them as evidence that a manager can read recipients;
 *  - if Georgios's answer (task 3.1) supplies a real contract, it replaces
 *    these rather than joining them.
 */

import { EVERYONE_GROUP_ID, RESEARCH_GROUP_ID } from "./current";

/**
 * A hypothetical answer to "which groups hold which roles on this dataset",
 * expressed in the vocabulary the model already uses so no new type is needed
 * for something that does not exist.
 */
export const proposedManagerRecipientGrants = [
  { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
  { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
  { groupId: EVERYONE_GROUP_ID, role: "dg_ds-browse" },
] as const;

/** The same hypothetical read with no Everyone browse grant present. */
export const proposedManagerRecipientGrantsWithoutEveryone = [
  { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
] as const;
