"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { DatasetWithCollections } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import {
  extractFavoriteDatasetIds,
  mapFavoritesToDatasets,
} from "@/lib/favorites";
import { logError } from "@/lib/logger";

interface DatasetContextType {
  favorites: string[];
  favoriteDatasets: DatasetWithCollections[];
  isFavoritesLoading: boolean;
  toggleFavorite: (datasetId: string) => Promise<void>;
  addFavorite: (datasetId: string) => Promise<void>;
  removeFavorite: (datasetId: string) => Promise<void>;
  isFavorite: (datasetId: string) => boolean;
  refreshFavorites: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const {
    hasToken,
    getUserFavorites,
    addFavoriteDataset,
    removeFavoriteDataset,
  } = useApi();

  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteDatasets, setFavoriteDatasets] = useState<
    DatasetWithCollections[]
  >([]);
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false);

  const refreshFavorites = useCallback(async () => {
    if (!hasToken) return;
    setIsFavoritesLoading(true);
    try {
      const raw = await getUserFavorites();
      setFavorites(extractFavoriteDatasetIds(raw));
      setFavoriteDatasets(mapFavoritesToDatasets(raw));
    } catch (error) {
      logError("Failed to load favorites", error);
    } finally {
      setIsFavoritesLoading(false);
    }
  }, [hasToken, getUserFavorites]);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  const isFavorite = useCallback(
    (datasetId: string) => favorites.includes(datasetId),
    [favorites],
  );

  const addFavorite = useCallback(
    async (datasetId: string) => {
      setFavorites((prev) =>
        prev.includes(datasetId) ? prev : [...prev, datasetId],
      );
      try {
        await addFavoriteDataset(datasetId);
        await refreshFavorites();
      } catch (error) {
        logError("Failed to add favorite", error);
        setFavorites((prev) => prev.filter((id) => id !== datasetId));
        throw error;
      }
    },
    [addFavoriteDataset, refreshFavorites],
  );

  const removeFavorite = useCallback(
    async (datasetId: string) => {
      const previousFavorites = favorites;
      const previousDatasets = favoriteDatasets;
      setFavorites((prev) => prev.filter((id) => id !== datasetId));
      setFavoriteDatasets((prev) => prev.filter((d) => d.id !== datasetId));
      try {
        await removeFavoriteDataset(datasetId);
      } catch (error) {
        logError("Failed to remove favorite", error);
        setFavorites(previousFavorites);
        setFavoriteDatasets(previousDatasets);
        throw error;
      }
    },
    [favorites, favoriteDatasets, removeFavoriteDataset],
  );

  const toggleFavorite = useCallback(
    async (datasetId: string) => {
      if (favorites.includes(datasetId)) {
        await removeFavorite(datasetId);
      } else {
        await addFavorite(datasetId);
      }
    },
    [favorites, addFavorite, removeFavorite],
  );

  return (
    <DatasetContext.Provider
      value={{
        favorites,
        favoriteDatasets,
        isFavoritesLoading,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        isFavorite,
        refreshFavorites,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (context === undefined) {
    throw new Error("useDataset must be used within a DatasetProvider");
  }
  return context;
}
