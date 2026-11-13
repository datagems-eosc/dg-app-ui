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
  const validMime = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime);
  if (validMime && MIME_LABELS[mime]) return MIME_LABELS[mime];
  const extension =
    typeof properties.name === "string"
      ? /\.([a-z0-9]+)$/i.exec(properties.name.trim())?.[1].toLowerCase()
      : undefined;
  if (extension) {
    return extension === "xls" || extension === "xlsx"
      ? "Excel"
      : extension.toUpperCase();
  }
  return validMime ? mime : undefined;
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
  const files = nodes.filter((node) => node.labels?.includes("cr:FileObject"));
  const formats = files.flatMap((node) => {
    const label = formatLabel(node.properties);
    return label ? [label] : [];
  });
  const sizes = files.flatMap((node) => {
    const bytes = parseBytes(node.properties?.contentSize);
    return bytes === undefined ? [] : [bytes];
  });
  const bytes = sizes.reduce((sum, value) => sum + value, 0);
  const size: ProfileFileSize =
    sizes.length && Number.isSafeInteger(bytes)
      ? {
          kind: sizes.length === files.length ? "complete" : "partial",
          bytes,
          knownFiles: sizes.length,
          representedFiles: files.length,
        }
      : { kind: "unavailable" };
  const records = nodes.filter((node) => node.labels?.includes("cr:RecordSet"));
  const profiling = records.flatMap((node) => {
    const id = nonblank(node.id);
    if (!id) return [];
    const fields = profilingFields(node);
    return fields.summary || fields.keywords.length ? [{ id, ...fields }] : [];
  });
  return { formats: [...new Set(formats)], size, profiling };
}

export type DatasetProfileMetadata = ReturnType<typeof deriveProfileMetadata>;
