const parseDatePublished = (dateStr) => {
  if (!dateStr) return 0;
  return new Date(dateStr).getTime();
};

const parseSize = (sizeStr) => {
  if (typeof sizeStr === "number") return sizeStr;
  if (!sizeStr || typeof sizeStr !== "string") return 0;

  const normalized = sizeStr.toLowerCase().trim();
  const match = normalized.match(/^([\d.]+)\s*(gb|mb|kb|b)?$/);

  if (!match) return 0;

  const value = Number.parseFloat(match[1]);
  const unit = match[2] || "b";

  const multipliers = {
    gb: 1024 * 1024 * 1024,
    mb: 1024 * 1024,
    kb: 1024,
    b: 1,
  };

  return value * (multipliers[unit] || 1);
};

const compareName = (a, b) => {
  const nameA = (a.title || a.name || "").toLowerCase();
  const nameB = (b.title || b.name || "").toLowerCase();
  return nameA.localeCompare(nameB);
};

const compareDatePublished = (a, b, descending = false) => {
  const dateA = parseDatePublished(a.datePublished);
  const dateB = parseDatePublished(b.datePublished);
  const result = dateA - dateB;
  return descending ? -result : result;
};

const compareSize = (a, b, descending = false) => {
  const sizeA = parseSize(a.size);
  const sizeB = parseSize(b.size);
  const result = sizeA - sizeB;
  return descending ? -result : result;
};

export const sortDatasetsWithSecondaryRules = (datasets, sortBy) => {
  const sorted = [...datasets];

  sorted.sort((a, b) => {
    if (sortBy.startsWith("name")) {
      const isDesc = sortBy.endsWith("desc");
      const primaryResult = isDesc ? -compareName(a, b) : compareName(a, b);

      if (primaryResult !== 0) return primaryResult;

      return compareDatePublished(a, b, true);
    }

    if (sortBy.startsWith("datePublished")) {
      const isDesc = sortBy.endsWith("desc");
      const primaryResult = compareDatePublished(a, b, isDesc);

      if (primaryResult !== 0) return primaryResult;

      return compareName(a, b);
    }

    if (sortBy.startsWith("size")) {
      const isDesc = sortBy.endsWith("desc");
      const primaryResult = compareSize(a, b, isDesc);

      if (primaryResult !== 0) return primaryResult;

      return compareName(a, b);
    }

    return 0;
  });

  return sorted;
};
