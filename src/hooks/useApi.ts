"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { logApiError, logApiRequest, logApiResponse } from "@/lib/logger";
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
      logApiRequest("queryDatasets", {
        endpoint: "/dataset/query",
        payload,
      });

      const response = await makeRequest("/dataset/query", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "X-Request-Type": "queryDatasets",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("queryDatasets", errorData);
        throw new Error(errorData.error || "Failed to fetch datasets");
      }

      const result = await response.json();
      logApiResponse("queryDatasets", {
        count: result.count,
        itemsCount: result.items?.length,
      });
      return result;
    },
    [makeRequest],
  );

  /**
   * Collection API methods
   */
  const queryCollections = useCallback(
    async (payload: any): Promise<any> => {
      logApiRequest("queryCollections", {
        endpoint: "/collection/query",
        payload,
      });

      const response = await makeRequest("/collection/query", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "X-Request-Type": "queryCollections",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("queryCollections", errorData);
        throw new Error(errorData.error || "Failed to fetch collections");
      }

      const result = await response.json();
      logApiResponse("queryCollections", {
        count: result.count,
        itemsCount: result.items?.length,
      });
      return result;
    },
    [makeRequest],
  );

  const queryUserCollections = useCallback(
    async (payload: any): Promise<any> => {
      logApiRequest("queryUserCollections", {
        endpoint: "/collection/query",
        payload,
      });

      const response = await makeRequest("/collection/query", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "X-Request-Type": "queryUserCollections",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("queryUserCollections", errorData);
        throw new Error(errorData.error || "Failed to fetch user collections");
      }

      const res = await response.json();
      logApiResponse("queryUserCollections", {
        count: res.count,
        itemsCount: res.items?.length,
      });
      return res;
    },
    [makeRequest],
  );

  const createUserCollection = useCallback(
    async (name: string): Promise<any> => {
      // Generate code from name (lowercase, replace spaces with dashes)
      const code = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      logApiRequest("createUserCollection", {
        endpoint: "/collection/persist",
        name,
        code,
      });

      const response = await makeRequest(
        "/collection/persist?f=id&f=name&f=code&f=datasets.id&f=datasets.name",
        {
          method: "POST",
          body: JSON.stringify({ name, code }),
          headers: {
            "X-Request-Type": "createCollection",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("createUserCollection", errorData);
        throw new Error(errorData.error || "Failed to create collection");
      }

      const result = await response.json();
      logApiResponse("createUserCollection", { collectionId: result.id });
      return result;
    },
    [makeRequest],
  );

  const addDatasetToUserCollection = useCallback(
    async (collectionId: string, datasetId: string): Promise<any> => {
      logApiRequest("addDatasetToCollection", {
        endpoint: `/collection/${collectionId}/dataset/${datasetId}`,
        collectionId,
        datasetId,
      });

      const response = await makeRequest(
        `/collection/${collectionId}/dataset/${datasetId}?f=id&f=name&f=datasets.id&f=datasets.name`,
        {
          method: "POST",
          headers: {
            "X-Request-Type": "addDatasetToCollection",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("addDatasetToCollection", errorData, {
          collectionId,
          datasetId,
        });
        throw new Error(
          errorData.error || "Failed to add dataset to collection",
        );
      }

      const result = await response.json();
      logApiResponse("addDatasetToCollection", { collectionId, datasetId });
      return result;
    },
    [makeRequest],
  );

  const removeDatasetFromUserCollection = useCallback(
    async (collectionId: string, datasetId: string): Promise<any> => {
      logApiRequest("removeDatasetFromCollection", {
        endpoint: `/collection/${collectionId}/dataset/${datasetId}`,
        collectionId,
        datasetId,
      });

      const response = await makeRequest(
        `/collection/${collectionId}/dataset/${datasetId}?f=id`,
        {
          method: "DELETE",
          headers: {
            "X-Request-Type": "removeDatasetFromCollection",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("removeDatasetFromCollection", errorData, {
          collectionId,
          datasetId,
        });
        throw new Error(
          errorData.error || "Failed to remove dataset from collection",
        );
      }

      const result = await response.json();
      logApiResponse("removeDatasetFromCollection", {
        collectionId,
        datasetId,
      });
      return result;
    },
    [makeRequest],
  );

  const deleteUserCollection = useCallback(
    async (collectionId: string): Promise<any> => {
      logApiRequest("deleteCollection", {
        endpoint: `/collection/${collectionId}`,
        collectionId,
      });

      const response = await makeRequest(`/collection/${collectionId}`, {
        method: "DELETE",
        headers: {
          "X-Request-Type": "deleteCollection",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("deleteCollection", errorData, { collectionId });
        throw new Error(errorData.error || "Failed to delete collection");
      }

      logApiResponse("deleteCollection", { collectionId });
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
