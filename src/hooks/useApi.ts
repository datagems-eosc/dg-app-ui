"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { fetchWithAuth, getApiBaseUrl } from "@/lib/utils";

/**
 * Custom hook for API access with automatic token management
 * Centralizes all API calls and provides consistent error handling
 */
export function useApi() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const baseUrl = useMemo(() => getApiBaseUrl(), []);

  /**
   * Make an authenticated API request
   */
  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
      if (!token) {
        throw new Error("No authentication token available");
      }

      const url = `${baseUrl}/gw/api${endpoint}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      };

      // Merge headers properly
      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      headers.Authorization = `Bearer ${token}`;

      return fetchWithAuth(url, {
        ...options,
        headers,
      });
    },
    [token, baseUrl],
  );

  /**
   * Dataset API methods
   */
  const queryDatasets = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/dataset/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch datasets");
      }

      return response.json();
    },
    [makeRequest],
  );

  /**
   * Collection API methods
   */
  const queryCollections = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/collection/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch collections");
      }

      return response.json();
    },
    [makeRequest],
  );

  const queryUserCollections = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/user/collection/me/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch user collections");
      }

      const res = await response.json();
      console.log("queryUserCollections req", payload, "res", res);
      return res;
    },
    [makeRequest],
  );

  const createUserCollection = useCallback(
    async (name: string): Promise<any> => {
      const response = await makeRequest(
        "/user/collection/me/persist?f=id&f=name&f=user.id&f=user.name&f=userDatasetCollections.id&f=userDatasetCollections.dataset.Id&f=userDatasetCollections.dataset.name",
        {
          method: "POST",
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create collection");
      }

      return response.json();
    },
    [makeRequest],
  );

  const addDatasetToUserCollection = useCallback(
    async (collectionId: string, datasetId: string): Promise<any> => {
      const response = await makeRequest(
        `/user/collection/dataset/me/${collectionId}/${datasetId}?f=id&f=UserDatasetCollections.id&f=UserDatasetCollections.dataset.id&f=name&f=user.id&f=user.name&f=UserDatasetCollections.dataset.name`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to add dataset to collection",
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const removeDatasetFromUserCollection = useCallback(
    async (collectionId: string, datasetId: string): Promise<any> => {
      const response = await makeRequest(
        `/user/collection/dataset/me/${collectionId}/${datasetId}?f=id`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to remove dataset from collection",
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const deleteUserCollection = useCallback(
    async (collectionId: string): Promise<any> => {
      const response = await makeRequest(`/user/collection/${collectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete collection");
      }

      return {};
    },
    [makeRequest],
  );

  /**
   * Search API methods
   */
  const searchInDataExplore = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/search/in-data-explore", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to search in data");
      }

      return response.json();
    },
    [makeRequest],
  );

  const searchCrossDataset = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/search/cross-dataset", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to search cross dataset");
      }

      return response.json();
    },
    [makeRequest],
  );

  /**
   * Conversation API methods
   */
  const getConversation = useCallback(
    async (id: string, queryParams: string): Promise<any> => {
      const response = await makeRequest(`/conversation/${id}${queryParams}`, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch conversation");
      }

      return response.json();
    },
    [makeRequest],
  );

  const queryConversations = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/conversation/me/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch conversations");
      }

      return response.json();
    },
    [makeRequest],
  );

  const persistConversation = useCallback(
    async (payload: any, queryParams: string): Promise<any> => {
      const response = await makeRequest(
        `/conversation/me/persist${queryParams}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to persist conversation");
      }

      return response.json();
    },
    [makeRequest],
  );

  const persistConversationDeep = useCallback(
    async (payload: any, queryParams: string): Promise<any> => {
      const response = await makeRequest(
        `/conversation/me/persist/deep${queryParams}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to persist conversation deep",
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const queryMessages = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/conversation/message/me/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch messages");
      }

      return response.json();
    },
    [makeRequest],
  );

  const updateConversation = useCallback(
    async (
      id: string,
      payload: { name: string; eTag: string },
    ): Promise<any> => {
      const response = await makeRequest(
        `/conversation/me/persist?f=id&f=etag&f=name`,
        {
          method: "POST",
          body: JSON.stringify({
            id: id,
            name: payload.name,
            eTag: payload.eTag,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update conversation");
      }

      return response.json();
    },
    [makeRequest],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<any> => {
      const response = await makeRequest(`/conversation/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete conversation");
      }

      return {};
    },
    [makeRequest],
  );

  /**
   * Vocabulary API methods
   */
  const getFieldsOfScience = useCallback(async (): Promise<any> => {
    const response = await makeRequest("/vocabulary/fields-of-science", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch fields of science");
    }

    return response.json();
  }, [makeRequest]);

  const getLicenses = useCallback(async (): Promise<any> => {
    const response = await makeRequest("/vocabulary/license", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch licenses");
    }

    return response.json();
  }, [makeRequest]);

  /**
   * User settings API methods
   */
  const getUserSettings = useCallback(
    async (settingsKey: string): Promise<any> => {
      const returnFields = ["id", "key", "value", "eTag"];
      const qs =
        returnFields && returnFields.length > 0
          ? `?${returnFields.map((f) => `f=${encodeURIComponent(f)}`).join("&")}`
          : "";

      const response = await makeRequest(
        `/user/settings/key/${settingsKey}${qs}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch user settings");
      }

      return response.json();
    },
    [makeRequest],
  );

  const saveUserSettings = useCallback(
    async (payload: any, id?: string): Promise<any> => {
      const body = { ...payload };
      if (id) {
        body.id = id;
      }
      body.value = JSON.stringify(body.value);

      const response = await makeRequest(`/user/settings/persist`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save user settings");
      }

      return response.json();
    },
    [makeRequest],
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
  };
}
