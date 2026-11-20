export interface CandidateSnapshot {
  generation: number;
  candidateIds: readonly string[];
  packagesCount: number;
  datasetsPerPackage: number;
}

export interface PackageMember {
  id: string;
  name: string;
  datePublished?: string;
}

export interface PackageView {
  key: string;
  name: string;
  datasets: readonly PackageMember[];
}

export type DecodedPackages =
  | { status: "ready"; packages: PackageView[] }
  | { status: "empty" | "unsupported-contract" };

export const datasetUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
