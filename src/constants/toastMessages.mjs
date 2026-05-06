export const TOAST_MESSAGES = {
  datasetAddedToCollection: {
    message: "Dataset added successfully to the collection!",
    type: "success",
  },
  datasetAddedToNamedCollection: (collectionName) => ({
    message: `Dataset added to ${collectionName} successfully.`,
    type: "success",
  }),
  datasetAddedToMultipleCollections: (count) => ({
    message: `Dataset added to ${count} collections successfully.`,
    type: "success",
  }),
  datasetRemovedFromCollection: (collectionName) => ({
    message: collectionName
      ? `Dataset removed from ${collectionName} successfully.`
      : "Dataset removed from collection.",
    type: "success",
  }),
  datasetRemoveFailed: {
    message: "Failed to remove dataset from collection. Please try again.",
    type: "error",
  },
  collectionDeleted: {
    message: "Collection deleted successfully!",
    type: "success",
  },
  collectionDeleteFailed: {
    message: "Failed to delete collection. Please try again.",
    type: "error",
  },
};
