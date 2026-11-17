/**
 * Similar-dataset recommendations — the outcome of one request.
 *
 * `GET /search/dataset/{id}/recommend` can answer with datasets, with an empty
 * list, refuse the caller (401, the user cannot browse the seed dataset) or
 * fail (424 from the Task Orchestrator, any other status, a network error).
 * The page explains each one differently, so they stay apart here.
 */

export type DatasetRecommendationsResult =
  | { status: "datasets"; datasets: unknown[] }
  | { status: "none" }
  | { status: "noAccess" }
  | { status: "failed" };

/** Reads a successful answer; anything that is not a list counts as none. */
export const recommendationsFromBody = (
  body: unknown,
): DatasetRecommendationsResult =>
  Array.isArray(body) && body.length > 0
    ? { status: "datasets", datasets: body }
    : { status: "none" };

/** Reads a non-success status: 401 is a refusal, everything else a failure. */
export const recommendationsFromStatus = (
  status: number,
): DatasetRecommendationsResult =>
  status === 401 ? { status: "noAccess" } : { status: "failed" };
