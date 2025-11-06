"use client";

import { useSession } from "next-auth/react";
import { useCallback } from "react";
import { apiClient } from "@/lib/apiClient";

/**
 * Custom hook for API access with automatic token management
 * Centralizes all API calls and provides consistent error handling
 */
export function useApi() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;

  /**
   * Generic API call wrapper with error handling
   */
  const callApi = useCallback(
    async <T>(
      apiMethod: (token: string, ...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T> => {
      if (!token) {
        throw new Error("No authentication token available");
      }

      try {
        return await apiMethod(token, ...args);
      } catch (error) {
        console.error("API call failed:", error);
        throw error;
      }
    },
    [token],
  );

  // Dataset API methods
  const queryDatasets = useCallback(
    (payload: any) => callApi(apiClient.queryDatasets.bind(apiClient), payload),
    [callApi],
  );

  // Collection API methods
  const queryCollections = useCallback(
    (payload: any) =>
      callApi(apiClient.queryCollections.bind(apiClient), payload),
    [callApi],
  );

  const queryUserCollections = useCallback(
    (payload: any) =>
      callApi(apiClient.queryUserCollections.bind(apiClient), payload),
    [callApi],
  );

  const createUserCollection = useCallback(
    (name: string) =>
      callApi(apiClient.createUserCollection.bind(apiClient), name),
    [callApi],
  );

  const addDatasetToUserCollection = useCallback(
    (collectionId: string, datasetId: string) =>
      callApi(
        apiClient.addDatasetToUserCollection.bind(apiClient),
        collectionId,
        datasetId,
      ),
    [callApi],
  );

  const removeDatasetFromUserCollection = useCallback(
    (collectionId: string, datasetId: string) =>
      callApi(
        apiClient.removeDatasetFromUserCollection.bind(apiClient),
        collectionId,
        datasetId,
      ),
    [callApi],
  );

  const deleteUserCollection = useCallback(
    (collectionId: string) =>
      callApi(apiClient.deleteUserCollection.bind(apiClient), collectionId),
    [callApi],
  );

  // Search API methods
  const searchInDataExplore = useCallback(
    (payload: any) =>
      callApi(apiClient.searchInDataExplore.bind(apiClient), payload),
    [callApi],
  );

  const searchCrossDataset = useCallback(
    (payload: any) =>
      callApi(apiClient.searchCrossDataset.bind(apiClient), payload),
    [callApi],
  );

  // Conversation API methods
  const getConversation = useCallback(
    (id: string, queryParams: string) =>
      callApi(apiClient.getConversation.bind(apiClient), id, queryParams),
    [callApi],
  );

  const queryConversations = useCallback(
    (payload: any) =>
      callApi(apiClient.queryConversations.bind(apiClient), payload),
    [callApi],
  );

  const persistConversation = useCallback(
    (payload: any, queryParams: string) =>
      callApi(
        apiClient.persistConversation.bind(apiClient),
        payload,
        queryParams,
      ),
    [callApi],
  );

  const persistConversationDeep = useCallback(
    (payload: any, queryParams: string) =>
      callApi(
        apiClient.persistConversationDeep.bind(apiClient),
        payload,
        queryParams,
      ),
    [callApi],
  );

  const queryMessages = useCallback(
    (payload: any) => callApi(apiClient.queryMessages.bind(apiClient), payload),
    [callApi],
  );

  const updateConversation = useCallback(
    (id: string, payload: { name: string; eTag: string }) =>
      callApi(apiClient.updateConversation.bind(apiClient), id, payload),
    [callApi],
  );

  const deleteConversation = useCallback(
    (id: string) => callApi(apiClient.deleteConversation.bind(apiClient), id),
    [callApi],
  );

  // Vocabulary API methods
  const getFieldsOfScience = useCallback(
    () => callApi(apiClient.getFieldsOfScience.bind(apiClient)),
    [callApi],
  );

  const getLicenses = useCallback(
    () => callApi(apiClient.getLicenses.bind(apiClient)),
    [callApi],
  );

  // User settings API methods
  const getUserSettings = useCallback(
    (settingsKey: string) =>
      callApi(apiClient.getUserSettings.bind(apiClient), settingsKey),
    [callApi],
  );

  const saveUserSettings = useCallback(
    (payload: any, id?: string) =>
      callApi(apiClient.saveUserSettings.bind(apiClient), payload, id),
    [callApi],
  );

  return {
    // Token info
    hasToken: !!token,
    token,

    // Dataset methods
    queryDatasets,

    // Collection methods
    queryCollections,
    queryUserCollections,
    createUserCollection,
    addDatasetToUserCollection,
    removeDatasetFromUserCollection,
    deleteUserCollection,

    // Search methods
    searchInDataExplore,
    searchCrossDataset,

    // Conversation methods
    getConversation,
    queryConversations,
    persistConversation,
    persistConversationDeep,
    queryMessages,
    updateConversation,
    deleteConversation,

    // Vocabulary methods
    getFieldsOfScience,
    getLicenses,

    // User settings methods
    getUserSettings,
    saveUserSettings,

    // Generic call method for custom usage
    callApi,
  };
}
