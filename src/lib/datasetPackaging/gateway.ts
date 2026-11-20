import { decodePackages } from "./adapter";
import {
  type CandidateSnapshot,
  type DecodedPackages,
  datasetUuid,
} from "./types";

const maxInt32 = 2 ** 31 - 1;

type Transport = (
  path: string,
  init: RequestInit,
  policy: { retryOn401: false },
) => Promise<Response>;

type RecommendationResult =
  | DecodedPackages
  | {
      status:
        | "unavailable"
        | "insufficient-candidates"
        | "invalid-request"
        | "unauthenticated"
        | "forbidden"
        | "error";
      httpStatus?: number;
    };

export async function recommendPackages(
  snapshot: CandidateSnapshot | null,
  transport: Transport,
): Promise<RecommendationResult> {
  if (!snapshot) return { status: "unavailable" };
  const { packagesCount, datasetsPerPackage } = snapshot;
  const datasetIds = [
    ...new Set(snapshot.candidateIds.map((id) => id.toLowerCase())),
  ];
  if (
    !Number.isSafeInteger(packagesCount) ||
    packagesCount < 1 ||
    packagesCount > maxInt32 ||
    !Number.isSafeInteger(datasetsPerPackage) ||
    datasetsPerPackage < 2 ||
    datasetsPerPackage > maxInt32 ||
    datasetIds.some((id) => !datasetUuid.test(id))
  )
    return { status: "invalid-request" };
  if (datasetsPerPackage > datasetIds.length)
    return { status: "insufficient-candidates" };
  const submittedSnapshot = { ...snapshot, candidateIds: datasetIds };
  let response: Response;
  try {
    response = await transport(
      "/search/package/recommend",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetIds,
          packagesCount,
          datasetsPerPackage,
          project: { fields: ["id", "name", "datePublished"] },
        }),
      },
      { retryOn401: false },
    );
  } catch {
    return { status: "error" };
  }
  if (!response.ok) {
    const httpStatus = response.status;
    if (httpStatus === 401) {
      // Gateway also uses 401 with its Forbidden code for inaccessible dataset IDs.
      const body = await response.json().catch(() => null);
      return {
        status: body?.code === 101 ? "forbidden" : "unauthenticated",
        httpStatus,
      };
    }
    if (httpStatus === 403) return { status: "forbidden", httpStatus };
    if (httpStatus === 400) return { status: "invalid-request", httpStatus };
    return { status: "error", httpStatus };
  }
  try {
    return decodePackages(await response.json(), submittedSnapshot);
  } catch {
    return { status: "unsupported-contract" };
  }
}
