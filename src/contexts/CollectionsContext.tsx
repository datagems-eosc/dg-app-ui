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
import logger, { logApiError } from "@/lib/logger";
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
        logger.debug("Skipping fetchApiCollections - no token available");
        return;
      }
      const data = await api.queryCollections(COLLECTIONS_API_PAYLOAD);
      const items = Array.isArray(data.items) ? data.items : [];
      setApiCollections(items);
      logger.debug(
        { count: items.length },
        "Successfully fetched API collections",
      );
    } catch (err: unknown) {
      logApiError("fetchApiCollections", err);
    } finally {
      setIsLoadingApiCollections(false);
    }
  }

  async function fetchExtraCollections() {
    setIsLoadingExtraCollections(true);
    try {
      if (!api.hasToken) {
        logger.debug("Skipping fetchExtraCollections - no token available");
        return;
      }
      const extraCollectionsPayload = {
        project: {
          fields: [
            "id",
            "code",
            "name",
            "datasets.id",
            "datasets.code",
            "datasets.name",
            "datasets.description",
            "datasets.license",
            "datasets.mimeType",
            "datasets.url",
            "datasets.version",
            "datasets.fieldOfScience",
            "datasets.keywords",
            "datasets.size",
            "datasets.datePublished",
            "datasets.collections.id",
            "datasets.collections.code",
            "datasets.collections.name",
            "datasets.collections.datasetCount",
            "datasets.permissions",
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
      const items = Array.isArray(data.items) ? data.items : [];
      setExtraCollections(items);
      logger.debug(
        { count: items.length },
        "Successfully fetched extra collections",
      );
    } catch (err: unknown) {
      logApiError("fetchExtraCollections", err);
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

  return (
    <CollectionsContext.Provider
      value={{
        collections: [...apiCollections, ...extraCollections],
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
