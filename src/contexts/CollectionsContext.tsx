'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { fetchWithAuth } from '@/lib/utils';
import { UserCollection, ApiCollection } from '@/types/collection';

interface CollectionsContextType {
  collections: UserCollection[];
  apiCollections: ApiCollection[];
  isLoadingApiCollections: boolean;
  addCollection: (name: string, datasetIds: string[]) => void;
  removeCollection: (id: string) => void;
  updateCollection: (id: string, updates: Partial<UserCollection>) => void;
  refreshApiCollections: () => Promise<void>;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);

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

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [apiCollections, setApiCollections] = useState<ApiCollection[]>([]);
  const [isLoadingApiCollections, setIsLoadingApiCollections] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load collections from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('userCollections');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Convert date strings back to Date objects
          const collectionsWithDates = parsed.map(collection => ({
            ...collection,
            createdAt: new Date(collection.createdAt)
          }));
          setCollections(collectionsWithDates);
        }
      } catch (error) {
        console.error('Error loading collections:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  // Fetch API collections when session is available
  useEffect(() => {
    const fetchApiCollections = async () => {
      setIsLoadingApiCollections(true);
      try {
        const token = (session as any)?.accessToken;
        if (!token) {
          return;
        }
        const response = await fetchWithAuth("/api/collection/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(COLLECTIONS_API_PAYLOAD),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch collections");
        }
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setApiCollections(items);
      } catch (err: unknown) {
        console.error("Failed to fetch collections:", err);
      } finally {
        setIsLoadingApiCollections(false);
      }
    };
    fetchApiCollections();
  }, [session]);

  // Save collections to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('userCollections', JSON.stringify(collections));
  }, [collections, isLoaded]);

  const addCollection = (name: string, datasetIds: string[]) => {
    const newCollection: UserCollection = {
      id: Date.now().toString(),
      name,
      datasetIds,
      createdAt: new Date(),
      icon: '📁' // Default icon
    };
    setCollections(prev => [...prev, newCollection]);
  };

  const removeCollection = (id: string) => {
    setCollections(prev => prev.filter(collection => collection.id !== id));
  };

  const updateCollection = (id: string, updates: Partial<UserCollection>) => {
    setCollections(prev => prev.map(collection => 
      collection.id === id 
        ? { ...collection, ...updates }
        : collection
    ));
  };

  const refreshApiCollections = async () => {
    setIsLoadingApiCollections(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        return;
      }
      const response = await fetchWithAuth("/api/collection/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(COLLECTIONS_API_PAYLOAD),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch collections");
      }
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setApiCollections(items);
    } catch (err: unknown) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setIsLoadingApiCollections(false);
    }
  };

  return (
    <CollectionsContext.Provider value={{
      collections,
      apiCollections,
      isLoadingApiCollections,
      addCollection,
      removeCollection,
      updateCollection,
      refreshApiCollections
    }}>
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections() {
  const context = useContext(CollectionsContext);
  if (context === undefined) {
    throw new Error('useCollections must be used within a CollectionsProvider');
  }
  return context;
} 