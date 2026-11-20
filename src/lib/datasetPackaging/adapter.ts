import {
  type CandidateSnapshot,
  type DecodedPackages,
  datasetUuid,
  type PackageMember,
  type PackageView,
} from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function decodePackages(
  value: unknown,
  snapshot: CandidateSnapshot,
): DecodedPackages {
  const invalid = { status: "unsupported-contract" } as const;
  if (!record(value) || !Array.isArray(value.packages)) return invalid;
  if (!value.packages.length) return { status: "empty" };

  // Consuming each candidate once checks both containment and disjointness.
  const available = new Set(
    snapshot.candidateIds.map((id) => id.toLowerCase()),
  );
  const packages: PackageView[] = [];
  for (const group of value.packages) {
    if (!record(group) || !named(group.name) || !Array.isArray(group.datasets))
      return invalid;
    const datasets: PackageMember[] = [];
    for (const member of group.datasets) {
      if (
        !record(member) ||
        typeof member.id !== "string" ||
        !datasetUuid.test(member.id) ||
        !named(member.name)
      )
        return invalid;
      const id = member.id.toLowerCase();
      if (!available.delete(id)) return invalid;
      const dataset: PackageMember = { id, name: member.name };
      if (named(member.datePublished))
        dataset.datePublished = member.datePublished;
      datasets.push(dataset);
    }
    packages.push({
      key: `${snapshot.generation}:${packages.length}`,
      name: group.name,
      datasets,
    });
  }
  return { status: "ready", packages };
}
