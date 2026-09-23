import { describe, expect, it } from "vitest";
import {
  type DatasetFormMetadata,
  publicationDateOf,
  toOnboardingMetadata,
} from "./form";

const form = (
  overrides: Partial<DatasetFormMetadata> = {},
): DatasetFormMetadata => ({
  title: "Sensor readings 2026",
  headline: "Pilot network readings",
  description: "Hourly readings from the pilot network.",
  keywords: ["sensors", "pilot"],
  fieldsOfScience: ["Environmental science"],
  license: "CC-BY-4.0",
  languages: ["en"],
  countries: ["GR"],
  sourceLink: "https://example.test/source",
  referenceString: "Cite as: pilot network, 2026",
  ...overrides,
});

describe("toOnboardingMetadata", () => {
  it("maps every form field onto the accepted start input", () => {
    expect(toOnboardingMetadata(form(), "2026-09-23")).toEqual({
      name: "Sensor readings 2026",
      headline: "Pilot network readings",
      description: "Hourly readings from the pilot network.",
      license: "CC-BY-4.0",
      keywords: ["sensors", "pilot"],
      fieldOfScience: ["Environmental science"],
      datePublished: "2026-09-23",
      language: ["en"],
      country: ["GR"],
      url: "https://example.test/source",
      citeAs: "Cite as: pilot network, 2026",
    });
  });

  it("omits optional fields that are empty rather than sending blanks", () => {
    const mapped = toOnboardingMetadata(
      form({
        languages: [],
        countries: ["  "],
        sourceLink: "   ",
        referenceString: "",
      }),
      "2026-09-23",
    );

    // An empty string is not a URL, and an empty citation is not a citation.
    expect(mapped).not.toHaveProperty("url");
    expect(mapped).not.toHaveProperty("citeAs");
    expect(mapped).not.toHaveProperty("language");
    expect(mapped).not.toHaveProperty("country");
  });

  it("trims the values it does send", () => {
    const mapped = toOnboardingMetadata(
      form({
        title: "  Sensor readings 2026  ",
        description: "  text  ",
        license: " CC-BY-4.0 ",
        keywords: [" sensors ", "", "pilot"],
        languages: [" en ", ""],
      }),
      "2026-09-23",
    );

    expect(mapped.name).toBe("Sensor readings 2026");
    expect(mapped.description).toBe("text");
    expect(mapped.license).toBe("CC-BY-4.0");
    expect(mapped.keywords).toEqual(["sensors", "pilot"]);
    expect(mapped.language).toEqual(["en"]);
  });

  it("never carries a collection, sharing, code, size or MIME field", () => {
    const mapped = toOnboardingMetadata(form(), "2026-09-23") as Record<
      string,
      unknown
    >;

    for (const absent of [
      "collection",
      "collections",
      "sharing",
      "accessType",
      "groups",
      "code",
      "size",
      "mimeType",
      "version",
      "conformsTo",
      "id",
    ]) {
      expect(mapped).not.toHaveProperty(absent);
    }
  });
});

describe("publicationDateOf", () => {
  it("produces the DateOnly shape the start contract expects", () => {
    expect(publicationDateOf(new Date("2026-09-23T21:45:10.123Z"))).toBe(
      "2026-09-23",
    );
  });
});
