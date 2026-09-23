/**
 * Dataset onboarding — form values to start metadata.
 *
 * One pure conversion, kept out of the form so the mapping can be read and
 * tested without mounting anything. It is a leaf like the rest of this
 * directory: no React, no HTTP, no clock. The publication date is an argument
 * rather than a `new Date()` call for exactly that reason.
 *
 * What it deliberately does not do:
 *
 *  - **no second validator.** `OnboardValidator` is the authority on a
 *    well-formed start, and the form already runs the repository's own field
 *    validation. A third copy of those rules here would drift from both;
 *  - **no file mapping.** Retained files become data locations in
 *    `submission.ts`, which is also what refuses an unresolved one. Splitting
 *    that across two modules would let a caller build locations without the
 *    refusal;
 *  - **no sharing, collection, code, size or MIME field.** The accepted
 *    adapter sends `DatasetPersist` fields only, and the private flow requests
 *    no sharing or collection at all.
 */

import type { OnboardingMetadataInput } from "./submission";

/**
 * The metadata the existing form collects, flattened. Declared structurally so
 * this leaf keeps no dependency on the form's own `FormData` shape.
 */
export interface DatasetFormMetadata {
  readonly title: string;
  readonly headline: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly fieldsOfScience: readonly string[];
  readonly license: string;
  readonly languages: readonly string[];
  readonly countries: readonly string[];
  readonly sourceLink: string;
  readonly referenceString: string;
}

const trimmed = (values: readonly string[]): readonly string[] =>
  values.map((value) => value.trim()).filter((value) => value !== "");

/**
 * Maps the form's fields onto the accepted start input.
 *
 * Field meanings are preserved from the existing start mapping: title → name,
 * the trimmed description and licence, keywords and fields of science as
 * supplied, languages → `language`, countries → `country`, the source link →
 * `url` and the reference string → `citeAs`.
 *
 * Empty optional values are **omitted** rather than sent as `""`. The Gateway's
 * `OnboardValidator` at the pinned revision requires name, description,
 * licence, headline, keywords, field of science, a publication date and at
 * least one data location, and says nothing about `url`, `citeAs`, `language`
 * or `country` — so an empty string there carries no meaning and an empty
 * `url` in particular is not a URL. This is source evidence, not a deployment
 * guarantee; a definite validation refusal remains a rejection the submission
 * controller models.
 */
export const toOnboardingMetadata = (
  form: DatasetFormMetadata,
  datePublished: string,
): OnboardingMetadataInput => {
  const language = trimmed(form.languages);
  const country = trimmed(form.countries);
  const url = form.sourceLink.trim();
  const citeAs = form.referenceString.trim();

  return {
    name: form.title.trim(),
    headline: form.headline.trim(),
    description: form.description.trim(),
    license: form.license.trim(),
    keywords: trimmed(form.keywords),
    fieldOfScience: trimmed(form.fieldsOfScience),
    datePublished,
    ...(language.length > 0 ? { language } : {}),
    ...(country.length > 0 ? { country } : {}),
    ...(url === "" ? {} : { url }),
    ...(citeAs === "" ? {} : { citeAs }),
  };
};

/** `YYYY-MM-DD` in UTC, the `DateOnly` shape the start contract expects. */
export const publicationDateOf = (now: Date): string =>
  now.toISOString().slice(0, 10);
