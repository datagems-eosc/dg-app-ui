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
import { UserCollection, ApiCollection } from "@/types/collection";

interface CollectionsContextType {
  collections: UserCollection[];
  apiCollections: ApiCollection[];
  extraCollections: ApiCollection[];
  isLoadingApiCollections: boolean;
  isLoadingExtraCollections: boolean;
  addCollection: (name: string, datasetIds: string[], id?: string) => void;
  addToCollection: (collectionId: string, datasetIds: string[]) => void;
  removeCollection: (id: string) => void;
  removeTimestampCollections: () => void;
  updateCollection: (id: string, updates: Partial<UserCollection>) => void;
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
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [apiCollections, setApiCollections] = useState<ApiCollection[]>([]);
  const [extraCollections, setExtraCollections] = useState<ApiCollection[]>([]);
  const [isLoadingApiCollections, setIsLoadingApiCollections] = useState(true);
  const [isLoadingExtraCollections, setIsLoadingExtraCollections] =
    useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load collections from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("userCollections");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Convert date strings back to Date objects
          const collectionsWithDates = parsed.map((collection) => ({
            ...collection,
            createdAt: new Date(collection.createdAt),
          }));
          setCollections(collectionsWithDates);
        }
      } catch (error) {
        console.error("Error loading collections:", error);
      }
    }
    setIsLoaded(true);
  }, []);

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
      console.error("Failed to fetch collections:", err);
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
            "userDatasetCollections.dataset.datasetCount",
          ],
        },
        page: {
          Offset: 0,
          Size: 10,
        },
        Order: {
          Items: ["+createdAt"],
        },
        Metadata: {
          CountAll: true,
        },
      };
      const data = await apiClient.queryUserCollections(
        extraCollectionsPayload,
        token
      );
      console.log("Extra collections data initial", data);
      const items = Array.isArray(data.items) ? data.items : [];
      setExtraCollections(items);
    } catch (err: unknown) {
      console.error("Failed to fetch extra collections:", err);
    } finally {
      setIsLoadingExtraCollections(false);
    }
  };

  // Save collections to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("userCollections", JSON.stringify(collections));
  }, [collections, isLoaded]);

  const addCollection = (name: string, datasetIds: string[], id?: string) => {
    const newCollection: UserCollection = {
      id: id || Date.now().toString(),
      name,
      datasetIds,
      createdAt: new Date(),
      icon: "📁", // Default icon
    };
    setCollections((prev) => [...prev, newCollection]);
    // Notify that collections have been modified to refresh sidebar
    notifyCollectionModified();
  };

  const addToCollection = (collectionId: string, datasetIds: string[]) => {
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              datasetIds: [
                ...new Set([...collection.datasetIds, ...datasetIds]),
              ],
            }
          : collection
      )
    );
    // Notify that collections have been modified to refresh sidebar
    notifyCollectionModified();
  };

  const removeCollection = (id: string) => {
    setCollections((prev) => prev.filter((collection) => collection.id !== id));
    // Notify that collections have been modified to refresh sidebar
    notifyCollectionModified();
  };

  const removeTimestampCollections = () => {
    setCollections((prev) =>
      prev.filter((collection) => {
        // Remove collections with timestamp IDs (10-13 digit numbers)
        const isTimestamp = /^\d{10,13}$/.test(collection.id);
        return !isTimestamp;
      })
    );
  };

  const updateCollection = (id: string, updates: Partial<UserCollection>) => {
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === id ? { ...collection, ...updates } : collection
      )
    );
    // Notify that collections have been modified to refresh sidebar
    notifyCollectionModified();
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
    refreshAllCollections();
  }, [refreshAllCollections]);

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        apiCollections,
        extraCollections,
        isLoadingApiCollections,
        isLoadingExtraCollections,
        addCollection,
        addToCollection,
        removeCollection,
        removeTimestampCollections,
        updateCollection,
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
