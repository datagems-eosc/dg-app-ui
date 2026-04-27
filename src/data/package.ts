export interface DatasetPackage {
  id: string;
  title: string;
  datasetIds: string[];
}

export const mockPackages: DatasetPackage[] = [
  {
    id: "pkg-1",
    title: "Climate Analysis Bundle",
    datasetIds: ["1", "2", "3", "4"],
  },
  {
    id: "pkg-1b",
    title: "Climate Research Pack",
    datasetIds: ["2", "3", "4"],
  },
  {
    id: "pkg-1c",
    title: "Climate Monitoring Starter",
    datasetIds: ["1", "4", "2"],
  },
  {
    id: "pkg-1d",
    title: "Climate Risk Indicators",
    datasetIds: ["4", "2", "3"],
  },
  {
    id: "pkg-1e",
    title: "Climate Trends Archive",
    datasetIds: ["4", "1", "3"],
  },
  {
    id: "pkg-1f",
    title: "Climate Forecast Essentials",
    datasetIds: ["1", "4", "2", "3"],
  },
  {
    id: "pkg-1g",
    title: "Climate Change Signals",
    datasetIds: ["4", "3", "2"],
  },
  {
    id: "pkg-1h",
    title: "Climate Impact Atlas",
    datasetIds: ["4", "1", "2"],
  },
  {
    id: "pkg-2",
    title: "Math Research Suite",
    datasetIds: ["5", "6", "7"],
  },
  {
    id: "pkg-3",
    title: "Lifelong Learning Collection",
    datasetIds: ["8", "9", "10"],
  },
  {
    id: "pkg-4",
    title: "Language & NLP Toolkit",
    datasetIds: ["11", "12", "13", "14"],
  },
  {
    id: "pkg-5",
    title: "Weather & Meteorology Pack",
    datasetIds: ["1", "2", "3"],
  },
  {
    id: "pkg-6",
    title: "Education Analytics Bundle",
    datasetIds: ["8", "9", "10"],
  },
];

export function filterPackagesBySearchTerm(
  packages: DatasetPackage[],
  searchTerm: string,
  getDatasetNameById: (id: string) => string,
): DatasetPackage[] {
  const term = searchTerm.trim().toLowerCase();
  if (term.length === 0) return packages;
  return packages.filter((pkg) => {
    if (pkg.title.toLowerCase().includes(term)) return true;
    const hasMatchingDataset = pkg.datasetIds.some((id) =>
      getDatasetNameById(id).toLowerCase().includes(term),
    );
    return hasMatchingDataset;
  });
}
