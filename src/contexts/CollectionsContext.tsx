"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/apiClient";
import { ApiCollection } from "@/types/collection";
import { logger } from "@/lib/logger";

interface CollectionsContextType {
  collections: ApiCollection[]; // Combined collections for backward compatibility
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
  undefined
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
  const { data: session } = useSession();
  const [apiCollections, setApiCollections] = useState<ApiCollection[]>([]);
  const [extraCollections, setExtraCollections] = useState<ApiCollection[]>([]);
  const [isLoadingApiCollections, setIsLoadingApiCollections] = useState(true);
  const [isLoadingExtraCollections, setIsLoadingExtraCollections] =
    useState(true);

  // Fetch API collections when session is available
  useEffect(() => {
    if (session) {
      fetchApiCollections();
      fetchExtraCollections();
    }
  }, [session]);

  const fetchApiCollections = async () => {
    setIsLoadingApiCollections(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        return;
      }
      const data = await apiClient.queryCollections(
        COLLECTIONS_API_PAYLOAD,
        token
      );
      const items = Array.isArray(data.items) ? data.items : [];
      setApiCollections(items);
    } catch (err: unknown) {
      logger.error({ error: err }, "Failed to fetch collections");
    } finally {
      setIsLoadingApiCollections(false);
    }
  };

  const fetchExtraCollections = async () => {
    setIsLoadingExtraCollections(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
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
          Size: 100, // Increased from 10 to 100 to ensure all collections are fetched
        },
        Order: {
          Items: ["+createdAt"],
        },
        Metadata: {
          CountAll: true,
        },
        // Add cache-busting timestamp to ensure fresh data
        _timestamp: Date.now(),
        // Add random cache-busting parameter
        _cacheBust: Math.random().toString(36).substring(7),
      };
      const data = await apiClient.queryUserCollections(
        extraCollectionsPayload,
        token
      );
      logger.debug({ data }, "Extra collections data fetched");
      const items = Array.isArray(data.items) ? data.items : [];
      logger.debug({ items }, "Setting extraCollections");
      setExtraCollections(items);
    } catch (err: unknown) {
      logger.error({ error: err }, "Failed to fetch extra collections");
    } finally {
      setIsLoadingExtraCollections(false);
    }
  };

  const refreshApiCollections = useCallback(async () => {
    await fetchApiCollections();
  }, [session]);

  const refreshExtraCollections = useCallback(async () => {
    await fetchExtraCollections();
  }, [session]);

  const refreshAllCollections = useCallback(async () => {
    await Promise.all([fetchApiCollections(), fetchExtraCollections()]);
  }, [session]);

  const notifyCollectionModified = useCallback(() => {
    // This function can be called by components to notify that collections have been modified
    // It will trigger a refresh of all collections
    // Force immediate refresh to ensure deleted collections are removed from UI
    setTimeout(() => {
      refreshAllCollections();
    }, 100); // Small delay to ensure API operation completes
  }, [refreshAllCollections]);

  return (
    <CollectionsContext.Provider
      value={{
        collections: [...apiCollections, ...extraCollections], // Combined collections for backward compatibility
        apiCollections,
        extraCollections,
        isLoadingApiCollections,
        isLoadingExtraCollections,
        addCollection: async (name, datasetIds) => {},
        updateCollection: async (id, updates) => {},
        removeCollection: async (id) => {},
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
