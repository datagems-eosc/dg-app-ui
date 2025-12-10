"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { getApiBaseUrl } from "@/lib/env";
import { logApiError, logApiRequest, logApiResponse } from "@/lib/logger";
import { fetchWithAuth } from "@/lib/utils";

export function useApi() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const baseUrl = useMemo(() => getApiBaseUrl(), []);

  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
      if (!token) {
        throw new Error(ApiErrorMessage.NO_AUTH_TOKEN);
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
      headers.oauth2 = token;

      return fetchWithAuth(url, {
        ...options,
        headers,
      });
    },
    [token, baseUrl],
  );

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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_DATASETS_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_COLLECTIONS_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_USER_COLLECTIONS_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.CREATE_COLLECTION_FAILED,
        );
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
          errorData.error || ApiErrorMessage.ADD_DATASET_TO_COLLECTION_FAILED,
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
          errorData.error ||
            ApiErrorMessage.REMOVE_DATASET_FROM_COLLECTION_FAILED,
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

  const getCollectionGrants = useCallback(
    async (collectionId: string): Promise<string[]> => {
      logApiRequest("getCollectionGrants", {
        endpoint: `/principal/me/context-grants/collection?id=${collectionId}`,
        collectionId,
      });

      const response = await makeRequest(
        `/principal/me/context-grants/collection?id=${collectionId}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("getCollectionGrants", errorData, { collectionId });
        return [];
      }

      const data = await response.json();
      logApiResponse("getCollectionGrants", {
        collectionId,
        grants: data.grants || [],
      });
      return data.grants || [];
    },
    [makeRequest],
  );

  const grantCollectionPermission = useCallback(
    async (
      userId: string,
      collectionId: string,
      role: string,
    ): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/user/${userId}/collection/${collectionId}/role/${role}`,
        {
          method: "POST",
          headers: {
            "X-Request-Type": "grantPermission",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to grant permission");
      }
    },
    [makeRequest],
  );

  const deleteCollection = useCallback(
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
        const errorMessage =
          errorData.error ||
          errorData.message ||
          ApiErrorMessage.DELETE_COLLECTION_FAILED;
        throw new Error(errorMessage);
      }

      logApiResponse("deleteCollection", { collectionId });
      return {};
    },
    [makeRequest],
  );

  const searchInDataExplore = useCallback(
    async (payload: any): Promise<any> => {
      const response = await makeRequest("/search/in-data-explore", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.SEARCH_IN_DATA_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.SEARCH_CROSS_DATASET_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const getConversation = useCallback(
    async (id: string, queryParams: string): Promise<any> => {
      const response = await makeRequest(`/conversation/${id}${queryParams}`, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_CONVERSATION_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_CONVERSATIONS_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.PERSIST_CONVERSATION_FAILED,
        );
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
          errorData.error || ApiErrorMessage.PERSIST_CONVERSATION_DEEP_FAILED,
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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_MESSAGES_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.UPDATE_CONVERSATION_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.DELETE_CONVERSATION_FAILED,
        );
      }

      return {};
    },
    [makeRequest],
  );

  const getFieldsOfScience = useCallback(async (): Promise<any> => {
    const response = await makeRequest("/vocabulary/fields-of-science", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || ApiErrorMessage.FETCH_FIELDS_OF_SCIENCE_FAILED,
      );
    }

    return response.json();
  }, [makeRequest]);

  const getLicenses = useCallback(async (): Promise<any> => {
    const response = await makeRequest("/vocabulary/license", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || ApiErrorMessage.FETCH_LICENSES_FAILED);
    }

    return response.json();
  }, [makeRequest]);

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
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_USER_SETTINGS_FAILED,
        );
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
        throw new Error(
          errorData.error || ApiErrorMessage.SAVE_USER_SETTINGS_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  return {
    hasToken: !!token,
    token,
    queryDatasets,
    queryCollections,
    queryUserCollections,
    createUserCollection,
    addDatasetToUserCollection,
    removeDatasetFromUserCollection,
    getCollectionGrants,
    grantCollectionPermission,
    deleteCollection,
    searchInDataExplore,
    searchCrossDataset,
    getConversation,
    queryConversations,
    persistConversation,
    persistConversationDeep,
    queryMessages,
    updateConversation,
    deleteConversation,
    getFieldsOfScience,
    getLicenses,
    getUserSettings,
    saveUserSettings,
  };
}
