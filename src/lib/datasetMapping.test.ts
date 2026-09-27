import { describe, expect, it } from "vitest";
import { mapApiDatasetToDataset } from "./datasetMapping";

/**
 * PM-01 finding F2.
 *
 * The mapper used to set `access: "Open Access"` whenever the payload's
 * `permissions` array contained `browsedataset` — the *caller's* ability to
 * browse. That is a statement about one principal read as a statement about
 * everyone, and it is the exact inference `lib/datasetPermissions` exists to
 * prevent: publication is decided from the Everyone audience's grants, which
 * this payload does not carry.
 *
 * The Gateway really does return that name, lower-cased: `DatasetBuilder` calls
 * `Extensions.ReduceToAssignedPermissions`, which lower-cases every requested
 * name before matching (dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`).
 * So the branch was live for any caller who could browse, which on a browse
 * listing is every dataset returned.
 */

const payload = (overrides: Record<string, unknown> = {}) => ({
  id: "0f0e0d0c-0b0a-4908-8706-050403020100",
  name: "Baltic Sea Salinity Profiles",
  description: "Synthetic fixture.",
  ...overrides,
});

describe("publication is never inferred from the caller's permissions", () => {
  it.each([
    ["browse", ["browsedataset"]],
    ["browse and edit", ["browsedataset", "editdataset"]],
    ["the original casing", ["BrowseDataset"]],
  ])("claims nothing from %s", (_label, permissions) => {
    expect(mapApiDatasetToDataset(payload({ permissions })).access).toBe(
      undefined,
    );
  });

  it("claims nothing when the payload carries no permissions at all", () => {
    expect(mapApiDatasetToDataset(payload()).access).toBe(undefined);
  });

  it("claims nothing for an empty permission list either", () => {
    // The opposite inference is no better: a caller who cannot browse has not
    // established that the dataset is restricted from everyone else.
    expect(mapApiDatasetToDataset(payload({ permissions: [] })).access).toBe(
      undefined,
    );
  });

  it("claims nothing for unreadable input", () => {
    expect(mapApiDatasetToDataset(null).access).toBe(undefined);
    expect(mapApiDatasetToDataset("not a dataset").access).toBe(undefined);
  });
});

describe("everything else the mapper is responsible for is unchanged", () => {
  it("keeps the identifying and descriptive fields", () => {
    const mapped = mapApiDatasetToDataset(
      payload({
        permissions: ["browsedataset"],
        license: "CC-BY-4.0",
        mimeType: "text/csv",
        size: "2.1 GB",
        datePublished: "2026-04-01",
        keywords: ["salinity", "baltic"],
        fieldOfScience: "oceanography",
        url: "https://example.invalid/d",
      }),
    );

    expect(mapped).toMatchObject({
      id: "0f0e0d0c-0b0a-4908-8706-050403020100",
      title: "Baltic Sea Salinity Profiles",
      description: "Synthetic fixture.",
      license: "CC-BY-4.0",
      mimeType: "text/csv",
      size: "2.1 GB",
      datePublished: "2026-04-01",
      keywords: ["salinity", "baltic"],
      // A single string is still normalised to a list.
      fieldOfScience: ["oceanography"],
      url: "https://example.invalid/d",
    });
  });

  it("keeps collection mapping and its filtering of unusable entries", () => {
    const mapped = mapApiDatasetToDataset(
      payload({
        collections: [
          { id: "c-1", name: "Marine", code: "MAR" },
          { id: "c-2" },
          "not a collection",
        ],
      }),
    );
    expect(mapped.collections).toEqual([
      { id: "c-1", name: "Marine", code: "MAR" },
    ]);
  });

  it("falls back to the code, then to Untitled, for a missing name", () => {
    expect(
      mapApiDatasetToDataset(payload({ name: undefined, code: "DS-7" })).title,
    ).toBe("DS-7");
    expect(mapApiDatasetToDataset(payload({ name: undefined })).title).toBe(
      "Untitled",
    );
  });
});
