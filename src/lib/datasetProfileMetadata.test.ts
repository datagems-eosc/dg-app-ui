import { describe, expect, it } from "vitest";
import { deriveProfileMetadata } from "./datasetProfileMetadata";

// Source-shaped synthetic graph based on the documented FileObject/RecordSet response.
const file = (id: unknown, properties: Record<string, unknown>) => ({
  id,
  labels: ["cr:FileObject"],
  properties,
});
const profile = (...nodes: unknown[]) => ({ nodes, edges: [] });

describe("profile formats", () => {
  it("normalizes MIME labels and uses extensions only without usable MIME", () => {
    const graph = profile(
      file("pdf", {
        encodingFormat: " Application/PDF; charset=utf-8 ",
        name: "wrong.csv",
      }),
      file("json", { encodingFormat: "application/json" }),
      file("csv", { encodingFormat: "text/csv" }),
      file("xls", { encodingFormat: "application/vnd.ms-excel" }),
      file("xlsx", {
        encodingFormat:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      file("unknown", { encodingFormat: "application/x-custom" }),
      file("extension", { name: "report.parquet", encodingFormat: "invalid" }),
      file("absent", {}),
    );
    expect(deriveProfileMetadata(JSON.stringify(graph)).formats).toEqual([
      "PDF",
      "JSON",
      "CSV",
      "Excel",
      "application/x-custom",
      "PARQUET",
    ]);
  });
});

it("omits ambiguous file identities and retains independent siblings", () => {
  expect(
    deriveProfileMetadata(
      profile(
        file("same", { encodingFormat: "application/pdf" }),
        file("same", { encodingFormat: "application/json" }),
        file(undefined, { encodingFormat: "text/csv" }),
        file("   ", { encodingFormat: "text/csv" }),
        file("valid", {
          name: "same.pdf",
          encodingFormat: "application/x-zip",
        }),
        file("valid", {
          encodingFormat: "application/x-zip",
          name: "same.pdf",
          unrelated: 1,
        }),
      ),
    ).formats,
  ).toEqual(["application/x-zip"]);
});

it("sums validated represented-file sizes once per ID, preserving zero", () => {
  const first = file("a", { name: "same.pdf", contentSize: " 140048 B " });
  expect(
    deriveProfileMetadata(
      profile(
        first,
        first,
        file("b", { name: "same.pdf", contentSize: 0 }),
        file("c", { contentSize: "005209" }),
      ),
    ),
  ).toMatchObject({
    size: {
      kind: "complete",
      bytes: 145257,
      knownFiles: 3,
      representedFiles: 3,
    },
  });
  expect(
    deriveProfileMetadata(profile(file("zero", { contentSize: "0 B" }))),
  ).toMatchObject({ size: { kind: "complete", bytes: 0 } });
});

it("marks known sizes as partial when represented files are unknown or ambiguous", () => {
  const invalid = [
    undefined,
    null,
    false,
    true,
    -1,
    1.5,
    Number.POSITIVE_INFINITY,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
    "2 MB",
    "1.5 B",
    "12oops",
    "1e3",
    "-1",
    "",
  ];
  for (const value of invalid) {
    expect(
      deriveProfileMetadata(
        profile(
          file("known", { contentSize: 0 }),
          file("missing", { contentSize: value }),
        ),
      ),
    ).toMatchObject({
      size: { kind: "partial", bytes: 0, knownFiles: 1, representedFiles: 2 },
    });
    expect(
      deriveProfileMetadata(profile(file("missing", { contentSize: value }))),
    ).toMatchObject({ size: { kind: "unavailable" } });
  }
  expect(
    deriveProfileMetadata(
      profile(
        file("known", { contentSize: 10 }),
        file(undefined, { contentSize: 20 }),
        file("conflict", { contentSize: 2 }),
        file("conflict", { contentSize: 3 }),
      ),
    ),
  ).toMatchObject({
    size: { kind: "partial", bytes: 10, knownFiles: 1, representedFiles: 3 },
  });
});

it("omits an overflowed aggregate instead of rounding or showing a lower total", () => {
  expect(
    deriveProfileMetadata(
      profile(
        file("a", { contentSize: Number.MAX_SAFE_INTEGER }),
        file("b", { contentSize: 1 }),
      ),
    ),
  ).toMatchObject({ size: { kind: "unavailable" } });
});

it.each([
  undefined,
  null,
  "",
  "not json",
  {},
  { nodes: null },
  { nodes: [] },
  [],
])("has no invented metadata for unavailable profiles: %j", (raw) => {
  expect(deriveProfileMetadata(raw)).toMatchObject({
    formats: [],
    size: { kind: "unavailable" },
  });
});

it("keeps coverage partial when a file's structural properties are malformed", () => {
  expect(
    deriveProfileMetadata(
      profile(
        null,
        [],
        { id: "bad", labels: ["cr:FileObject", null], properties: [] },
        file("good", { encodingFormat: "application/pdf", contentSize: 1 }),
      ),
    ),
  ).toMatchObject({
    formats: ["PDF"],
    size: { kind: "partial", bytes: 1, representedFiles: 2 },
  });
});

it("reads independent profiler information from a fieldless PDF RecordSet", () => {
  const raw = profile(file("pdf", { encodingFormat: "application/pdf" }), {
    id: "record",
    labels: ["cr:RecordSet"],
    properties: {
      name: "Nursing",
      summary: "Profiler summary",
      keywords: ["nursing"],
    },
  });
  expect(deriveProfileMetadata(raw)).toMatchObject({
    profiling: [
      {
        id: "record",
        name: "Nursing",
        summary: "Profiler summary",
        keywords: ["nursing"],
      },
    ],
  });
});

it("keeps partial profiler fields and normalizes keyword strings without guessed delimiters", () => {
  const record = (id: unknown, properties: Record<string, unknown>) => ({
    id,
    labels: ["cr:RecordSet"],
    properties,
  });
  const first = record("a", {
    name: "Same",
    summary: "  ",
    keywords: "one, two",
  });
  const nodes = [
    first,
    first,
    record("b", {
      name: "Same",
      summary: " Summary ",
      keywords: [" one ", null, 42, {}, "", "one", "One", "two"],
    }),
    record("c", { summary: "Summary only", keywords: false }),
    record("bad", { summary: "Conflict" }),
    record("bad", { summary: "Other" }),
    record(null, { summary: "No identity" }),
    record("blank", { summary: 4, keywords: { value: "bad" } }),
  ];
  const result = deriveProfileMetadata(profile(...nodes)).profiling;
  expect(result).toEqual([
    { id: "a", name: "Same", summary: undefined, keywords: ["one, two"] },
    {
      id: "b",
      name: "Same",
      summary: "Summary",
      keywords: ["one", "One", "two"],
    },
    { id: "c", name: undefined, summary: "Summary only", keywords: [] },
  ]);
  expect(
    deriveProfileMetadata(profile(...nodes.toReversed())).profiling,
  ).toEqual(result.toReversed());
});

it("rejects IDs shared by conflicting node kinds and keeps valid file coverage partial", () => {
  const result = deriveProfileMetadata(
    profile(
      file("collision", {
        encodingFormat: "application/pdf",
        contentSize: 100,
      }),
      {
        id: "collision",
        labels: ["cr:RecordSet"],
        properties: { summary: "Ambiguous summary", keywords: ["ambiguous"] },
      },
      file("valid", { encodingFormat: "application/json", contentSize: 20 }),
      {
        id: "record",
        labels: ["cr:RecordSet"],
        properties: { summary: "Valid summary" },
      },
    ),
  );
  expect(result).toEqual({
    formats: ["JSON"],
    size: { kind: "partial", bytes: 20, knownFiles: 1, representedFiles: 2 },
    profiling: [
      { id: "record", name: undefined, summary: "Valid summary", keywords: [] },
    ],
  });
});
