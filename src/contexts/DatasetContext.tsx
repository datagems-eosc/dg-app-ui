'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface DatasetContextType {
  favorites: string[];
  toggleFavorite: (datasetId: string) => void;
  isFavorite: (datasetId: string) => boolean;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load favorites from localStorage only after component mounts
  useEffect(() => {
    if (isMounted) {
      const savedFavorites = localStorage.getItem('datagemsFavorites');
      if (savedFavorites) {
        try {
          setFavorites(JSON.parse(savedFavorites));
        } catch (error) {
          logger.error({ error }, 'Error loading favorites from localStorage');
        }
      }
    }
  }, [isMounted]);

  // Save favorites to localStorage whenever it changes (only when mounted)
  useEffect(() => {
    if (isMounted && favorites.length >= 0) {
      localStorage.setItem('datagemsFavorites', JSON.stringify(favorites));
    }
  }, [favorites, isMounted]);

  const toggleFavorite = (datasetId: string) => {
    setFavorites(prev => 
      prev.includes(datasetId)
        ? prev.filter(id => id !== datasetId)
        : [...prev, datasetId]
    );
  };

  const isFavorite = (datasetId: string) => {
    return favorites.includes(datasetId);
  };

  return (
    <DatasetContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (context === undefined) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
} 