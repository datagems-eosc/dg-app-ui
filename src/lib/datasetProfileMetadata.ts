import { type ProfileGraph, parseProfileRaw } from "./datasetProfile";

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/json": "JSON",
  "text/csv": "CSV",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

function formatLabel(
  properties: Record<string, unknown> = {},
): string | undefined {
  const mime =
    typeof properties.encodingFormat === "string"
      ? properties.encodingFormat.split(";")[0].trim().toLowerCase()
      : "";
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)) {
    return MIME_LABELS[mime] ?? mime;
  }
  const extension =
    typeof properties.name === "string"
      ? /\.([a-z0-9]+)$/i.exec(properties.name.trim())?.[1].toLowerCase()
      : undefined;
  if (!extension) return undefined;
  return extension === "xls" || extension === "xlsx"
    ? "Excel"
    : extension.toUpperCase();
}

export type ProfileFileSize =
  | { kind: "unavailable" }
  | {
      kind: "complete" | "partial";
      bytes: number;
      knownFiles: number;
      representedFiles: number;
    };

function parseBytes(value: unknown): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\s*B)?$/.test(value.trim())
        ? Number(value.trim().replace(/\s*B$/, ""))
        : undefined;
  return number !== undefined && Number.isSafeInteger(number) && number >= 0
    ? number
    : undefined;
}

type ProfileNode = NonNullable<ProfileGraph["nodes"]>[number];

function uniqueNodes(
  nodes: ProfileNode[],
  signature: (node: ProfileNode) => string,
  conflictingIds: Set<string>,
) {
  const byId = new Map<
    string,
    { node: ProfileNode & { id: string }; signature: string } | null
  >();
  let ambiguous = false;
  let unidentified = 0;
  for (const node of nodes) {
    const id = typeof node.id === "string" ? node.id.trim() : "";
    if (!id) {
      ambiguous = true;
      unidentified++;
      continue;
    }
    if (conflictingIds.has(id)) {
      byId.set(id, null);
      ambiguous = true;
      continue;
    }
    const current = signature(node);
    const previous = byId.get(id);
    if (previous === undefined)
      byId.set(id, { node: { ...node, id }, signature: current });
    else if (previous === null || previous.signature !== current) {
      byId.set(id, null);
      ambiguous = true;
    }
  }
  return {
    nodes: [...byId.values()].flatMap((entry) => (entry ? [entry.node] : [])),
    ambiguous,
    representedFiles: byId.size + unidentified,
  };
}

function nonblank(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function profilingFields(node: ProfileNode) {
  const properties = node.properties ?? {};
  const values =
    typeof properties.keywords === "string"
      ? [properties.keywords]
      : Array.isArray(properties.keywords)
        ? properties.keywords
        : [];
  const keywords = [
    ...new Set(
      values.flatMap((value) => {
        const keyword = nonblank(value);
        return keyword ? [keyword] : [];
      }),
    ),
  ];
  return {
    name: nonblank(properties.name),
    summary: nonblank(properties.summary),
    keywords,
  };
}

export function deriveProfileMetadata(raw: unknown) {
  const graph = parseProfileRaw(raw);
  const nodes = graph?.nodes ?? [];
  const kindsById = new Map<string, string>();
  const conflictingIds = new Set<string>();
  for (const node of nodes) {
    const id = nonblank(node.id);
    if (!id) continue;
    const kind = (node.labels ?? [])
      .filter((label) => label === "cr:FileObject" || label === "cr:RecordSet")
      .sort()
      .join(",");
    const previous = kindsById.get(id);
    if (previous !== undefined && previous !== kind) conflictingIds.add(id);
    kindsById.set(id, kind);
  }
  const files = uniqueNodes(
    nodes.filter((node) => node.labels?.includes("cr:FileObject")),
    (node) =>
      JSON.stringify([
        formatLabel(node.properties),
        parseBytes(node.properties?.contentSize),
      ]),
    conflictingIds,
  );
  const formats = files.nodes.flatMap((node) => {
    const label = formatLabel(node.properties);
    return label ? [label] : [];
  });
  const sizes = files.nodes.flatMap((node) => {
    const bytes = parseBytes(node.properties?.contentSize);
    return bytes === undefined ? [] : [bytes];
  });
  const bytes = sizes.reduce((sum, value) => sum + value, 0);
  const size: ProfileFileSize =
    sizes.length && Number.isSafeInteger(bytes)
      ? {
          kind:
            !files.ambiguous && sizes.length === files.nodes.length
              ? "complete"
              : "partial",
          bytes,
          knownFiles: sizes.length,
          representedFiles: files.representedFiles,
        }
      : { kind: "unavailable" };
  const records = uniqueNodes(
    nodes.filter((node) => node.labels?.includes("cr:RecordSet")),
    (node) => JSON.stringify(profilingFields(node)),
    conflictingIds,
  );
  const profiling = records.nodes.flatMap((node) => {
    const fields = profilingFields(node);
    return fields.summary || fields.keywords.length
      ? [{ id: node.id, ...fields }]
      : [];
  });
  return { formats: [...new Set(formats)], size, profiling };
}

export type DatasetProfileMetadata = ReturnType<typeof deriveProfileMetadata>;
