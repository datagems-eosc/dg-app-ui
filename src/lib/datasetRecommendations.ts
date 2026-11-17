/**
 * Similar-dataset recommendations — the outcome of one request.
 *
 * `GET /search/dataset/{id}/recommend` can answer with datasets, with an empty
 * list, refuse the caller (401, the user cannot browse the seed dataset) or
 * fail (424 from the Task Orchestrator, any other status, a network error).
 * The page explains each one differently, so they stay apart here.
 */

import {
  type MappedDataset,
  mapApiDatasetToDataset,
} from "@/lib/datasetMapping";

/** How many similar datasets the page asks for and shows. */
export const RECOMMENDATION_COUNT = 6;

/** The recommend query: the card fields and the count. */
export const RECOMMENDATION_QUERY = [
  "id",
  "name",
  "description",
  "keywords",
  "fieldOfScience",
  "license",
  "url",
  "mimeType",
  "datePublished",
  "collections.id",
  "collections.name",
  "collections.code",
  "permissions",
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
 * display. Anything that is not a list counts as none.
 */
export const recommendationsFromBody = (
  body: unknown,
): DatasetRecommendationsResult =>
  Array.isArray(body) && body.length > 0
    ? {
        status: "datasets",
        datasets: body
          .slice(0, RECOMMENDATION_COUNT)
          .map(mapApiDatasetToDataset),
      }
    : { status: "none" };

/** Reads a non-success status: 401 is a refusal, everything else a failure. */
export const recommendationsFromStatus = (
  status: number,
): DatasetRecommendationsResult =>
  status === 401 ? { status: "noAccess" } : { status: "failed" };
