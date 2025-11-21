"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useApi } from "@/hooks/useApi";
import type { ApiCollection } from "@/types/collection";

interface CollectionsContextType {
  collections: ApiCollection[];
  apiCollections: ApiCollection[];
  extraCollections: ApiCollection[];
  isLoadingApiCollections: boolean;
  isLoadingExtraCollections: boolean;
  addCollection: (name: string, datasetIds: string[]) => Promise<void>;
  updateCollection: (id: string, updates: any) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  refreshApiCollections: () => Promise<void>;
  refreshExtraCollections: () => Promise<void>;
  refreshAllCollections: () => Promise<void>;
  notifyCollectionModified: () => void;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(
  undefined,
);

const COLLECTIONS_API_PAYLOAD = {
  project: {
    fields: [
      "id",
      "code",
      "name",
      "datasets.id",
      "datasets.code",
      "datasets.name",
      "datasetCount",
      "permissions.browseDataset",
    ],
  },
  page: {
    Offset: 0,
    Size: 50,
  },
  Order: {
    Items: ["+name"],
  },
  Metadata: {
    CountAll: true,
  },
};

export function CollectionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const api = useApi();
  const [apiCollections, setApiCollections] = useState<ApiCollection[]>([]);
  const [extraCollections, setExtraCollections] = useState<ApiCollection[]>([]);
  const [isLoadingApiCollections, setIsLoadingApiCollections] = useState(true);
  const [isLoadingExtraCollections, setIsLoadingExtraCollections] =
    useState(true);

  useEffect(() => {
    if (api.hasToken) {
      fetchApiCollections();
      fetchExtraCollections();
    }
  }, [api.hasToken]);

  async function fetchApiCollections() {
    setIsLoadingApiCollections(true);
    try {
      if (!api.hasToken) {
        return;
      }
      const data = await api.queryCollections(COLLECTIONS_API_PAYLOAD);
      const items = Array.isArray(data.items) ? data.items : [];
      // Filter only standard collections (those with datasets field, not userDatasetCollections)
      const standardCollections = items.filter(
        (item: any) =>
          item.datasets !== undefined && !item.userDatasetCollections,
      );
      console.log("Standard collections filtered:", standardCollections);
      setApiCollections(standardCollections);
    } catch (err: unknown) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setIsLoadingApiCollections(false);
    }
  }

  async function fetchExtraCollections() {
    setIsLoadingExtraCollections(true);
    try {
      if (!api.hasToken) {
        return;
      }
      const extraCollectionsPayload = {
        project: {
          fields: [
            "id",
            "code",
            "name",
            "userDatasetCollections.id",
            "userDatasetCollections.dataset.id",
            "userDatasetCollections.dataset.code",
            "userDatasetCollections.dataset.name",
            "userDatasetCollections.dataset.description",
            "userDatasetCollections.dataset.license",
            "userDatasetCollections.dataset.mimeType",
            "userDatasetCollections.dataset.url",
            "userDatasetCollections.dataset.version",
            "userDatasetCollections.dataset.fieldOfScience",
            "userDatasetCollections.dataset.keywords",
            "userDatasetCollections.dataset.size",
            "userDatasetCollections.dataset.datePublished",
            "userDatasetCollections.dataset.collections.id",
            "userDatasetCollections.dataset.collections.code",
            "userDatasetCollections.dataset.collections.name",
            "userDatasetCollections.dataset.collections.datasetCount",
            "userDatasetCollections.dataset.permissions.browseDataset",
            "userDatasetCollections.dataset.permissions.editDataset",
          ],
        },
        page: {
          Offset: 0,
          Size: 100,
        },
        Order: {
          Items: ["+createdAt"],
        },
        Metadata: {
          CountAll: true,
        },
        _timestamp: Date.now(),
        _cacheBust: Math.random().toString(36).substring(7),
      };
      const data = await api.queryUserCollections(extraCollectionsPayload);
      console.log("Extra collections data fetched:", data);
      const items = Array.isArray(data.items) ? data.items : [];
      // Filter only user collections (those with userDatasetCollections field)
      const userCollections = items.filter(
        (item: any) => item.userDatasetCollections !== undefined,
      );
      console.log("User collections filtered:", userCollections);
      setExtraCollections(userCollections);
    } catch (err: unknown) {
      console.error("Failed to fetch extra collections:", err);
    } finally {
      setIsLoadingExtraCollections(false);
    }
  }

  const refreshApiCollections = useCallback(async () => {
    await fetchApiCollections();
  }, [api.hasToken]);

  const refreshExtraCollections = useCallback(async () => {
    await fetchExtraCollections();
  }, [api.hasToken]);

  const refreshAllCollections = useCallback(async () => {
    await Promise.all([fetchApiCollections(), fetchExtraCollections()]);
  }, [api.hasToken]);

  const notifyCollectionModified = useCallback(() => {
    setTimeout(() => {
      refreshAllCollections();
    }, 100);
  }, [refreshAllCollections]);

  // Deduplicate collections by ID
  const allCollections = [...apiCollections, ...extraCollections];
  const uniqueCollectionsMap = new Map();
  allCollections.forEach((c) => {
    if (!uniqueCollectionsMap.has(c.id)) {
      uniqueCollectionsMap.set(c.id, c);
    }
  });
  const uniqueCollections = Array.from(uniqueCollectionsMap.values());

  return (
    <CollectionsContext.Provider
      value={{
        collections: uniqueCollections,
        apiCollections,
        extraCollections,
        isLoadingApiCollections,
        isLoadingExtraCollections,
        addCollection: async (_name, _datasetIds) => {},
        updateCollection: async (_id, _updates) => {},
        removeCollection: async (_id) => {},
        refreshApiCollections,
        refreshExtraCollections,
        refreshAllCollections,
        notifyCollectionModified,
      }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections() {
  const context = useContext(CollectionsContext);
  if (context === undefined) {
    throw new Error("useCollections must be used within a CollectionsProvider");
  }
  return context;
}
