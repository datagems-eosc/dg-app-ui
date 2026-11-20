import { type Selection, selectedDatasetIds } from "./selection";

export function packageDestinations(selection: Selection) {
  return {
    datasetIds: selectedDatasetIds(selection),
    chatAvailable: false,
    collectionAvailable: false,
  } as const;
}
