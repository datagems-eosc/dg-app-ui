export const ids = Array.from(
  { length: 5 },
  (_, index) => `00000000-0000-4000-8000-00000000000${index + 1}`,
);

export const snapshot = {
  generation: 2,
  candidateIds: ids,
  packagesCount: 2,
  datasetsPerPackage: 3,
};

export const recommendation = {
  packages: [
    {
      name: "Package 1",
      datasets: ids
        .slice(0, 3)
        .map((id, index) => ({ id, name: `Dataset ${index}` })),
    },
  ],
};
