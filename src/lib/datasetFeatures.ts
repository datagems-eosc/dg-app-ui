/**
 * Dataset feature status — which DataGEMS services already know a dataset.
 *
 * `GET /dataset/{id}?f=features` answers with `features.profiled` (Data
 * Management has it ready), `features.packaged` (dataset packaging) and
 * `features.recommendation` (the recommender). The Gateway asks those services
 * on every such request, so a flag can be missing when the answer is not the
 * expected shape; a missing flag means "unknown", never `false`.
 */

export type DatasetFeatures = {
  profiled?: boolean;
  packaged?: boolean;
  recommendation?: boolean;
};

const FLAGS = ["profiled", "packaged", "recommendation"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads the flags from a dataset body, keeping only boolean values. Null when
 * the body has no `features` object.
 */
export const featuresFromBody = (body: unknown): DatasetFeatures | null => {
  if (!isRecord(body) || !isRecord(body.features)) return null;
  const { features } = body;
  const result: DatasetFeatures = {};
  for (const flag of FLAGS) {
    const value = features[flag];
    if (typeof value === "boolean") result[flag] = value;
  }
  return result;
};
