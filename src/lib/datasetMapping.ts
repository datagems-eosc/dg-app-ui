import type { Collection, Dataset } from "@/data/dataset";

export type MappedDataset = Dataset & {
  collections?: Collection[];
  license?: string;
  mimeType?: string;
  fieldOfScience?: string[];
  size?: string;
  datePublished?: string;
};

/**
 * Maps a raw dataset object from the gateway API into the local `Dataset`
 * shape used by the UI. Defensive against missing/oddly-typed fields.
 */
export function mapApiDatasetToDataset(api: unknown): MappedDataset {
  if (typeof api !== "object" || api === null) {
    return {
      id: "",
      title: "Untitled",
      category: "Math",
      access: "Restricted",
      description: "",
      size: "N/A",
      lastUpdated: "2024-01-01",
      tags: [],
      collections: [],
      license: undefined,
      mimeType: undefined,
      fieldOfScience: undefined,
      datePublished: undefined,
      keywords: undefined,
    };
  }
  const obj = api as Record<string, unknown>;
  const collections: Collection[] = Array.isArray(obj.collections)
    ? obj.collections
        .map((c) =>
          typeof c === "object" && c !== null && "name" in c && "id" in c
            ? {
                id: String((c as Record<string, unknown>).id ?? ""),
                name: String((c as Record<string, unknown>).name),
                code: String((c as Record<string, unknown>).code ?? ""),
              }
            : undefined,
        )
        .filter(
          (c): c is Collection =>
            !!c && typeof c.id === "string" && typeof c.name === "string",
        )
    : [];

  let fieldOfScience: string[] | undefined;
  if (obj.fieldOfScience) {
    if (Array.isArray(obj.fieldOfScience)) {
      fieldOfScience = obj.fieldOfScience.map(String);
    } else if (typeof obj.fieldOfScience === "string") {
      fieldOfScience = [obj.fieldOfScience];
    }
  }

  let keywords: string[] | undefined;
  if (obj.keywords) {
    if (Array.isArray(obj.keywords)) {
      keywords = obj.keywords.map(String);
    } else if (typeof obj.keywords === "string") {
      keywords = [obj.keywords];
    }
  }

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: "Math", // fallback only
    access:
      Array.isArray(obj.permissions) &&
      obj.permissions.includes("browsedataset")
        ? "Open Access"
        : "Restricted",
    description: String(obj.description ?? ""),
    size: obj.size ? String(obj.size) : "N/A",
    lastUpdated: obj.datePublished ? String(obj.datePublished) : "2024-01-01",
    tags: [],
    collections,
    license: obj.license ? String(obj.license) : undefined,
    mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
    fieldOfScience,
    datePublished: obj.datePublished ? String(obj.datePublished) : undefined,
    keywords,
    url: obj.url ? String(obj.url) : undefined,
  };
}
