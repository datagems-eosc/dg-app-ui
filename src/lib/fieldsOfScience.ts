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
 * the option value is the vocabulary name, the label its sentence case. The
 * dropdown selects by code, because the vocabulary repeats some names.
 */

const normalise = (value: string) => value.trim().toLowerCase();

/** A stored value matches an entry by its code, or its name in any casing. */
const matches = (value: string, code: string | undefined, name: string) =>
  code === value.trim() || normalise(name) === normalise(value);

/** The child field a stored or selected value matches. */
function findFieldOfScience(
  value: string,
  categories: readonly HierarchicalCategory[],
): HierarchicalOption | undefined {
  for (const category of categories) {
    const option = category.options.find((o) =>
      matches(value, o.code, o.value),
    );
    if (option) return option;
  }
  return undefined;
}

/** The top-level category a value matches. */
const findCategory = (
  value: string,
  categories: readonly HierarchicalCategory[],
) => categories.find((c) => matches(value, c.code, c.name));

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
 * The dropdown selection (codes) for stored values. A stored name the
 * vocabulary repeats selects its first listed field. Values that match no
 * field, bare categories included, stay unselected.
 */
export function toFieldOfScienceOptionValues(
  values: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const selected = values.flatMap((value) => {
    const option = findFieldOfScience(value, categories);
    return option ? [option.code] : [];
  });
  return [...new Set(selected)];
}

/**
 * The vocabulary names to store for selected fields: a code or a stored name
 * becomes the name the Gateway returns (`MATHEMATICS`). Values the vocabulary
 * does not know are kept as given.
 */
export function fieldOfScienceNames(
  values: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const names = values.map(
    (value) => findFieldOfScience(value, categories)?.value ?? value,
  );
  return [...new Set(names)];
}

/**
 * The dataset-query `fieldsOfScience` values for selected fields: each field's
 * name and its code, so datasets still stored by code are found too. The data
 * model service matches exactly, ignoring case, and OR-s the values. Values
 * the vocabulary does not know are sent as given.
 */
export function fieldOfScienceFilterValues(
  selected: readonly string[],
  categories: readonly HierarchicalCategory[],
): string[] {
  const values = selected.flatMap((value) => {
    const option = findFieldOfScience(value, categories);
    return option ? [option.value, option.code] : [value];
  });
  return [...new Set(values)];
}
