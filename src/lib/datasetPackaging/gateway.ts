import { decodePackages } from "./adapter";
import {
  type CandidateSnapshot,
  type DecodedPackages,
  datasetUuid,
} from "./types";

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
    packagesCount > 2 ** 31 - 1 ||
    !Number.isSafeInteger(datasetsPerPackage) ||
    datasetsPerPackage < 2 ||
    datasetIds.some((id) => !datasetUuid.test(id))
  )
    return { status: "invalid-request" };
  if (datasetsPerPackage > datasetIds.length)
    return { status: "insufficient-candidates" };
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
    const statuses: Readonly<
      Partial<
        Record<number, "invalid-request" | "unauthenticated" | "forbidden">
      >
    > = {
      400: "invalid-request",
      401: "unauthenticated",
      403: "forbidden",
    };
    return {
      status: statuses[response.status] ?? "error",
      httpStatus: response.status,
    };
  }
  try {
    return decodePackages(await response.json(), snapshot);
  } catch {
    return { status: "unsupported-contract" };
  }
}
