/**
 * Similar-dataset recommendations — what the section shows for a dataset.
 *
 * `GET /search/dataset/{id}/recommend` can answer with datasets, with an empty
 * list, refuse the caller (401, the user cannot browse the seed dataset) or
 * fail (424 from the Task Orchestrator, any other status, a network error).
 * One more outcome comes from not asking at all: the dataset's feature status
 * says the recommender does not know it. The page explains each one
 * differently, so they stay apart here.
 */

import {
  type MappedDataset,
  mapApiDatasetToDataset,
} from "@/lib/datasetMapping";

/** How many similar datasets the page asks for and shows. */
export const RECOMMENDATION_COUNT = 6;

/**
 * The recommend query: only what the card shows (title, description, licence,
 * collection name) and the id it opens, plus the count.
 */
export const RECOMMENDATION_QUERY = [
  "id",
  "name",
  "description",
  "license",
  "collections.id",
  "collections.name",
]
  .map((field) => `f=${field}`)
  .concat(`n=${RECOMMENDATION_COUNT}`)
  .join("&");

export type DatasetRecommendationsResult =
  | { status: "datasets"; datasets: MappedDataset[] }
  | { status: "none" }
  | { status: "noAccess" }
  | { status: "failed" }
  // Not asked: the dataset's feature status says the recommender does not
  // know it (`features.recommendation: false`).
  | { status: "notKnown" };

/**
 * Reads a successful answer: at most RECOMMENDATION_COUNT datasets, mapped for
 * display; an empty list is none. Anything that is not a list is outside the
 * contract and counts as a failure, never as "none".
 */
export const recommendationsFromBody = (
  body: unknown,
): DatasetRecommendationsResult => {
  if (!Array.isArray(body)) return { status: "failed" };
  if (body.length === 0) return { status: "none" };
  return {
    status: "datasets",
    datasets: body.slice(0, RECOMMENDATION_COUNT).map(mapApiDatasetToDataset),
  };
};

/** Reads a non-success status: 401 is a refusal, everything else a failure. */
export const recommendationsFromStatus = (
  status: number,
): DatasetRecommendationsResult =>
  status === 401 ? { status: "noAccess" } : { status: "failed" };
