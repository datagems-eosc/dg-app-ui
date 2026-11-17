import type {
  HierarchicalCategory,
  HierarchicalOption,
} from "@/components/ui/HierarchicalDropdown";

/**
 * Fields-of-science values, matched against the Gateway vocabulary.
 *
 * Datasets store their fields of science as plain strings. Partner datasets
 * store the vocabulary name (`MATHEMATICS`); datasets onboarded through the
 * app before names were sent store the code (`1.1`). These helpers resolve
 * either form against the vocabulary as `processFieldsOfScience` shapes it:
 * the option value is the vocabulary name, the label its sentence case.
 */

const normalise = (value: string) => value.trim().toLowerCase();

/** The child field whose code or name (any casing) a stored value matches. */
export function findFieldOfScience(
  value: string,
  categories: readonly HierarchicalCategory[],
): HierarchicalOption | undefined {
  const name = normalise(value);
  for (const category of categories) {
    const option = category.options.find(
      (o) => o.code === value.trim() || normalise(o.value) === name,
    );
    if (option) return option;
  }
  return undefined;
}

/** The top-level category whose code or name (any casing) a value matches. */
const findCategory = (
  value: string,
  categories: readonly HierarchicalCategory[],
) =>
  categories.find(
    (c) => c.code === value.trim() || normalise(c.name) === normalise(value),
  );

/**
 * Readable labels for stored values, in stored order: a known field or
 * category shows its sentence-case name, anything else stays as stored. A
 * field stored both as code and as name shows once.
 */
export function fieldOfScienceLabels(
  values: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const labels = values.map(
    (value) =>
      findFieldOfScience(value, categories)?.label ??
      findCategory(value, categories)?.name ??
      value,
  );
  return [...new Set(labels)];
}

/**
 * The dropdown option values (vocabulary names) that stored values select.
 * Values that match no field, bare categories included, stay unselected.
 */
export function toFieldOfScienceOptionValues(
  values: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const selected = values.flatMap((value) => {
    const option = findFieldOfScience(value, categories);
    return option ? [option.value] : [];
  });
  return [...new Set(selected)];
}

/**
 * The dataset-query `fieldsOfScience` values for selected fields: each name
 * plus every code the vocabulary lists it under, so datasets still stored by
 * code are found too. The data model service matches exactly, ignoring case,
 * and OR-s the values.
 */
export function fieldOfScienceFilterValues(
  selected: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const values = selected.flatMap((name) => {
    const codes = categories.flatMap((category) =>
      category.options
        .filter((o) => o.value === name && o.code)
        .map((o) => o.code as string),
    );
    return [name, ...codes];
  });
  return [...new Set(values)];
}
