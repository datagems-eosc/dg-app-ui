"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { publicEnv } from "@/lib/env";
import type { UserFavorite } from "@/lib/favorites";
import { logApiError, logApiRequest, logApiResponse } from "@/lib/logger";
import { fetchWithAuth, getApiBaseUrl, getLogoutUrl } from "@/lib/utils";
import type { ContextGrant } from "@/types/contextGrants";
import type {
  UserGroupLookup,
  UserGroupQueryResult,
  UserLookup,
  UserQueryResult,
} from "@/types/userDirectory";
import type { UserSettings, UserSettingsPersist } from "@/types/userSettings";

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
      const isFormData = options.body instanceof FormData;
      const headers: Record<string, string> = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      };
      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }
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
        const errorMessage =
          errorData.error ||
          errorData.message ||
          ApiErrorMessage.FETCH_DATASETS_FAILED;

        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("queryDatasets", {
            ...errorData,
            statusCode: response.status,
          });
        }

        const enhancedMessage =
          response.status >= 500
            ? `Server error (${response.status}): ${errorMessage}. Please contact support if the issue persists.`
            : errorMessage;

        throw new Error(enhancedMessage);
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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("queryCollections", errorData);
        }
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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("queryUserCollections", errorData);
        }
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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("createUserCollection", errorData);
        }
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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("addDatasetToCollection", errorData, {
            collectionId,
            datasetId,
          });
        }
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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("removeDatasetFromCollection", errorData, {
            collectionId,
            datasetId,
          });
        }
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

  const getUserDatasetGrants = useCallback(
    async (
      userId: string,
      datasetIds: string[],
    ): Promise<Record<string, string[]>> => {
      const params = datasetIds
        .map((id) => `id=${encodeURIComponent(id)}`)
        .join("&");
      const response = await makeRequest(
        `/principal/user/${userId}/context-grants/dataset?${params}`,
        { method: "GET" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_USER_GRANTS_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const getGroupDatasetGrants = useCallback(
    async (
      groupId: string,
      datasetIds: string[],
    ): Promise<Record<string, string[]>> => {
      const params = datasetIds
        .map((id) => `id=${encodeURIComponent(id)}`)
        .join("&");
      const response = await makeRequest(
        `/principal/group/${groupId}/context-grants/dataset?${params}`,
        { method: "GET" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_GROUP_GRANTS_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const getUserCollectionGrants = useCallback(
    async (
      userId: string,
      collectionIds: string[],
    ): Promise<Record<string, string[]>> => {
      const params = collectionIds
        .map((id) => `id=${encodeURIComponent(id)}`)
        .join("&");
      const response = await makeRequest(
        `/principal/user/${userId}/context-grants/collection?${params}`,
        { method: "GET" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_USER_GRANTS_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const getGroupCollectionGrants = useCallback(
    async (
      groupId: string,
      collectionIds: string[],
    ): Promise<Record<string, string[]>> => {
      const params = collectionIds
        .map((id) => `id=${encodeURIComponent(id)}`)
        .join("&");
      const response = await makeRequest(
        `/principal/group/${groupId}/context-grants/collection?${params}`,
        { method: "GET" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_GROUP_GRANTS_FAILED,
        );
      }

      return response.json();
    },
    [makeRequest],
  );

  const assignUserDatasetGrant = useCallback(
    async (userId: string, datasetId: string, role: string): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/user/${userId}/dataset/${datasetId}/role/${role}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ApiErrorMessage.ASSIGN_GRANT_FAILED);
      }
    },
    [makeRequest],
  );

  const unassignUserDatasetGrant = useCallback(
    async (userId: string, datasetId: string, role: string): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/user/${userId}/dataset/${datasetId}/role/${role}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.UNASSIGN_GRANT_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const assignGroupDatasetGrant = useCallback(
    async (groupId: string, datasetId: string, role: string): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/group/${groupId}/dataset/${datasetId}/role/${role}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ApiErrorMessage.ASSIGN_GRANT_FAILED);
      }
    },
    [makeRequest],
  );

  const unassignGroupDatasetGrant = useCallback(
    async (groupId: string, datasetId: string, role: string): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/group/${groupId}/dataset/${datasetId}/role/${role}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.UNASSIGN_GRANT_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const assignUserCollectionGrant = useCallback(
    async (
      userId: string,
      collectionId: string,
      role: string,
    ): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/user/${userId}/collection/${collectionId}/role/${role}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ApiErrorMessage.ASSIGN_GRANT_FAILED);
      }
    },
    [makeRequest],
  );

  const unassignUserCollectionGrant = useCallback(
    async (
      userId: string,
      collectionId: string,
      role: string,
    ): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/user/${userId}/collection/${collectionId}/role/${role}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.UNASSIGN_GRANT_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const assignGroupCollectionGrant = useCallback(
    async (
      groupId: string,
      collectionId: string,
      role: string,
    ): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/group/${groupId}/collection/${collectionId}/role/${role}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ApiErrorMessage.ASSIGN_GRANT_FAILED);
      }
    },
    [makeRequest],
  );

  const unassignGroupCollectionGrant = useCallback(
    async (
      groupId: string,
      collectionId: string,
      role: string,
    ): Promise<void> => {
      const response = await makeRequest(
        `/principal/context-grants/group/${groupId}/collection/${collectionId}/role/${role}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.UNASSIGN_GRANT_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const getCurrentUserContextGrants = useCallback(async (): Promise<
    ContextGrant[]
  > => {
    logApiRequest("getCurrentUserContextGrants", {
      endpoint: "/principal/me/context-grants",
    });

    const response = await makeRequest("/principal/me/context-grants", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData && Object.keys(errorData).length > 0) {
        logApiError("getCurrentUserContextGrants", errorData);
      }
      throw new Error(errorData.error || ApiErrorMessage.FETCH_GRANTS_FAILED);
    }

    const data = await response.json();
    logApiResponse("getCurrentUserContextGrants", {
      count: Array.isArray(data) ? data.length : 0,
    });
    return Array.isArray(data) ? data : [];
  }, [makeRequest]);

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
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("deleteCollection", errorData, { collectionId });
        }
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

  const queryUsers = useCallback(
    async (payload: UserLookup): Promise<UserQueryResult> => {
      logApiRequest("queryUsers", {
        endpoint: "/user/query",
        payload,
      });

      const response = await makeRequest("/user/query", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to query users");
      }

      return response.json();
    },
    [makeRequest],
  );

  const queryUserGroups = useCallback(
    async (payload: UserGroupLookup): Promise<UserGroupQueryResult> => {
      const endpoint = publicEnv("USER_GROUPS_ENDPOINT", "/user/group/query");
      logApiRequest("queryUserGroups", {
        endpoint,
        payload,
      });

      const response = await makeRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawMsg =
          errorData.error ??
          errorData.message ??
          `Failed to query user groups (${response.status})`;
        const msg =
          typeof rawMsg === "string"
            ? rawMsg
            : Array.isArray(rawMsg)
              ? (rawMsg as { Key?: string; Value?: string[] }[])
                  .map((e) => `${e.Key ?? "?"}: ${(e.Value ?? []).join(", ")}`)
                  .join("; ")
              : String(rawMsg);
        throw new Error(msg);
      }

      return response.json();
    },
    [makeRequest],
  );

  const buildFieldsQuery = (fields?: string[]) => {
    if (!fields || fields.length === 0) return "";
    return `?${fields.map((f) => `f=${encodeURIComponent(f)}`).join("&")}`;
  };

  const getUserSettingsByKey = useCallback(
    async (
      settingsKey: string,
      fields: string[] = [
        "id",
        "key",
        "value",
        "eTag",
        "createdAt",
        "updatedAt",
      ],
    ): Promise<UserSettings[]> => {
      const qs = buildFieldsQuery(fields);

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

  const getDatasetById = useCallback(
    async (id: string, fields?: string[]): Promise<any> => {
      const qs = buildFieldsQuery(fields);
      logApiRequest("getDatasetById", { endpoint: `/dataset/${id}` });

      const response = await makeRequest(
        `/dataset/${encodeURIComponent(id)}${qs}`,
        {
          method: "GET",
          headers: { "X-Request-Type": "getDatasetById" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("getDatasetById", errorData, { id });
        }
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_DATASET_DETAILS_FAILED,
        );
      }

      const result = await response.json();
      logApiResponse("getDatasetById", { id });
      return result;
    },
    [makeRequest],
  );

  const downloadDatasetFile = useCallback(
    async (datasetId: string, fileObjectNodeId: string): Promise<Response> => {
      logApiRequest("downloadDatasetFile", { datasetId, fileObjectNodeId });

      const response = await makeRequest(
        `/storage/download/dataset/${encodeURIComponent(datasetId)}/file-object/${encodeURIComponent(fileObjectNodeId)}`,
        {
          method: "GET",
          headers: { "X-Request-Type": "downloadDatasetFile" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("downloadDatasetFile", errorData, {
            datasetId,
            fileObjectNodeId,
          });
        }
        throw new Error(
          errorData.error || ApiErrorMessage.DOWNLOAD_FILE_FAILED,
        );
      }

      logApiResponse("downloadDatasetFile", { datasetId, fileObjectNodeId });
      return response;
    },
    [makeRequest],
  );

  const getDatasetRecommendations = useCallback(
    async (
      datasetId: string,
      n = 6,
      fields: string[] = [
        "id",
        "name",
        "description",
        "keywords",
        "fieldOfScience",
        "license",
        "url",
        "mimeType",
        "datePublished",
        "collections.id",
        "collections.name",
        "collections.code",
        "permissions",
      ],
    ): Promise<any[]> => {
      if (!token) return [];

      const params = fields.map((f) => `f=${encodeURIComponent(f)}`);
      params.push(`n=${n}`);
      const url = `${baseUrl}/gw/api/search/dataset/${encodeURIComponent(
        datasetId,
      )}/recommend?${params.join("&")}`;

      logApiRequest("getDatasetRecommendations", { datasetId, n });

      try {
        // Plain fetch (NOT fetchWithAuth): the recommend endpoint returns
        // 401 "insufficient rights" for datasets the user can't access, and
        // fetchWithAuth would treat that as an auth failure and force a logout.
        // Recommendations are a non-critical footer, so degrade to empty.
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            oauth2: token,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "X-Request-Type": "getDatasetRecommendations",
          },
        });

        if (!response.ok) {
          logApiError(
            "getDatasetRecommendations",
            { status: response.status },
            { datasetId },
          );
          return [];
        }

        const result = await response.json();
        const items = Array.isArray(result) ? result : [];
        logApiResponse("getDatasetRecommendations", {
          datasetId,
          count: items.length,
        });
        return items;
      } catch (error) {
        logApiError("getDatasetRecommendations", error, { datasetId });
        return [];
      }
    },
    [token, baseUrl],
  );

  const getUserFavorites = useCallback(
    async (
      fields: string[] = [
        "id",
        "dataset.id",
        "dataset.name",
        "dataset.description",
        "dataset.keywords",
        "dataset.fieldOfScience",
        "dataset.datePublished",
        "dataset.license",
        "dataset.url",
        "dataset.permissions",
        "dataset.collections.id",
        "dataset.collections.name",
        "dataset.collections.code",
      ],
    ): Promise<UserFavorite[]> => {
      const qs = buildFieldsQuery(fields);
      logApiRequest("getUserFavorites", {
        endpoint: "/user/settings/favorites/dataset",
      });

      const response = await makeRequest(
        `/user/settings/favorites/dataset${qs}`,
        {
          method: "GET",
          headers: { "X-Request-Type": "getUserFavorites" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("getUserFavorites", errorData);
        }
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_FAVORITES_FAILED,
        );
      }

      const result = await response.json();
      logApiResponse("getUserFavorites", {
        count: Array.isArray(result) ? result.length : 0,
      });
      return Array.isArray(result) ? result : [];
    },
    [makeRequest],
  );

  const addFavoriteDataset = useCallback(
    async (datasetId: string): Promise<UserFavorite> => {
      logApiRequest("addFavoriteDataset", {
        endpoint: "/user/settings/favorites/dataset/persist",
        datasetId,
      });

      const response = await makeRequest(
        "/user/settings/favorites/dataset/persist?f=id&f=dataset.id",
        {
          method: "POST",
          body: JSON.stringify({ datasetId }),
          headers: { "X-Request-Type": "addFavoriteDataset" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("addFavoriteDataset", errorData, { datasetId });
        }
        throw new Error(errorData.error || ApiErrorMessage.ADD_FAVORITE_FAILED);
      }

      const result = await response.json();
      logApiResponse("addFavoriteDataset", { datasetId });
      return result;
    },
    [makeRequest],
  );

  const removeFavoriteDataset = useCallback(
    async (datasetId: string): Promise<void> => {
      logApiRequest("removeFavoriteDataset", {
        endpoint: `/user/settings/favorites/dataset/${datasetId}`,
        datasetId,
      });

      const response = await makeRequest(
        `/user/settings/favorites/dataset/${encodeURIComponent(datasetId)}`,
        {
          method: "DELETE",
          headers: { "X-Request-Type": "removeFavoriteDataset" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && Object.keys(errorData).length > 0) {
          logApiError("removeFavoriteDataset", errorData, { datasetId });
        }
        throw new Error(
          errorData.error || ApiErrorMessage.REMOVE_FAVORITE_FAILED,
        );
      }

      logApiResponse("removeFavoriteDataset", { datasetId });
    },
    [makeRequest],
  );

  const getUserSettingsById = useCallback(
    async (
      id: string,
      fields: string[] = [
        "id",
        "key",
        "value",
        "eTag",
        "createdAt",
        "updatedAt",
      ],
    ): Promise<UserSettings> => {
      const qs = buildFieldsQuery(fields);

      const response = await makeRequest(`/user/settings/id/${id}${qs}`, {
        method: "GET",
      });

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

  const deleteUserSettingsById = useCallback(
    async (id: string): Promise<void> => {
      const response = await makeRequest(`/user/settings/id/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.DELETE_USER_SETTINGS_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const deleteUserSettingsByKey = useCallback(
    async (key: string): Promise<void> => {
      const response = await makeRequest(`/user/settings/key/${key}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || ApiErrorMessage.DELETE_USER_SETTINGS_FAILED,
        );
      }
    },
    [makeRequest],
  );

  const getUserSettings = getUserSettingsByKey;

  const saveUserSettings = useCallback(
    async (
      payload: UserSettingsPersist & { value: unknown },
      id?: string,
    ): Promise<UserSettings> => {
      const body: UserSettingsPersist & { value: string } = {
        ...payload,
        value: JSON.stringify(payload.value),
      };
      if (id) {
        body.id = id;
      }

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

  const getRecommendNextQueries = useCallback(
    async (
      query: string,
      conversationId?: string,
    ): Promise<{
      result?: Array<{ query?: string | null }> | null;
      conversationId?: string | null;
      next_queries?: string[];
    }> => {
      if (!token) {
        throw new Error(ApiErrorMessage.NO_AUTH_TOKEN);
      }

      logApiRequest("getRecommendNextQueries", {
        endpoint: "/search/recommend",
        query,
      });

      const requestPayload: {
        query: string;
        conversationOptions?: {
          conversationId?: string;
          autoCreateConversation?: boolean;
        };
        project?: {
          fields: string[];
        };
      } = {
        query: query,
        project: {
          fields: ["query"],
        },
      };

      if (conversationId) {
        requestPayload.conversationOptions = {
          conversationId,
          autoCreateConversation: false,
        };
      }

      const response = await makeRequest("/search/recommend", {
        method: "POST",
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("getRecommendNextQueries", errorData);
        throw new Error(
          errorData.error || ApiErrorMessage.FETCH_RECOMMENDATIONS_FAILED,
        );
      }

      const result = await response.json();
      logApiResponse("getRecommendNextQueries", {
        queriesCount: result.result?.length || result.next_queries?.length || 0,
      });
      return result;
    },
    [makeRequest, token],
  );

  const getUploadAllowedExtensions = useCallback(async (): Promise<
    string[]
  > => {
    logApiRequest("getUploadAllowedExtensions", {
      endpoint: "/storage/upload/allowed-extension",
    });
    const response = await makeRequest("/storage/upload/allowed-extension", {
      method: "GET",
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logApiError("getUploadAllowedExtensions", errorData);
      throw new Error(
        errorData.error || ApiErrorMessage.FETCH_ALLOWED_EXTENSIONS_FAILED,
      );
    }
    const result = await response.json();
    logApiResponse("getUploadAllowedExtensions", {
      count: Array.isArray(result) ? result.length : 0,
    });
    return Array.isArray(result) ? result : [];
  }, [makeRequest]);

  const uploadDatasetFiles = useCallback(
    async (
      files: File[],
      onProgress?: (loaded: number, total: number) => void,
    ): Promise<string[]> => {
      if (!files.length) return [];
      if (!token) {
        throw new Error(ApiErrorMessage.NO_AUTH_TOKEN);
      }
      logApiRequest("uploadDatasetFiles", {
        endpoint: "/storage/upload/dataset",
        fileCount: files.length,
      });

      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file${index + 1}`, file);
      });

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${baseUrl}/gw/api/storage/upload/dataset`;

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(event.loaded, event.total);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 401 && typeof window !== "undefined") {
            if (window.location.pathname !== getLogoutUrl()) {
              window.location.href = getLogoutUrl();
            }
            reject(new Error(ApiErrorMessage.NO_AUTH_TOKEN));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            let errorData: Record<string, unknown> = {};
            try {
              errorData = JSON.parse(xhr.responseText) ?? {};
            } catch {
              /* ignore */
            }
            logApiError("uploadDatasetFiles", {
              ...errorData,
              statusCode: xhr.status,
            });
            reject(
              new Error(
                (errorData.error as string) ||
                  ApiErrorMessage.UPLOAD_DATASET_FAILED,
              ),
            );
            return;
          }
          try {
            const result = JSON.parse(xhr.responseText);
            const rawPaths = Array.isArray(result) ? result : [];
            const paths = rawPaths.map((item: unknown) => {
              if (typeof item === "string") return item;
              if (typeof item === "object" && item !== null) {
                const obj = item as Record<string, unknown>;
                const loc =
                  obj.Location ?? obj.location ?? obj.path ?? obj.Path;
                return typeof loc === "string" ? loc : "";
              }
              return "";
            });
            logApiResponse("uploadDatasetFiles", {
              pathCount: paths.length,
            });
            resolve(paths);
          } catch {
            reject(new Error(ApiErrorMessage.UPLOAD_DATASET_FAILED));
          }
        });

        xhr.addEventListener("error", () => {
          logApiError("uploadDatasetFiles", { network: true });
          reject(new Error(ApiErrorMessage.UPLOAD_DATASET_FAILED));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error(ApiErrorMessage.UPLOAD_DATASET_FAILED));
        });

        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("oauth2", token);
        xhr.setRequestHeader(
          "Cache-Control",
          "no-cache, no-store, must-revalidate",
        );
        xhr.send(formData);
      });
    },
    [token, baseUrl],
  );

  const onboardDataset = useCallback(
    async (payload: {
      code: string;
      name: string;
      description: string;
      license: string;
      mimeType: string;
      size: number;
      url?: string;
      version?: string;
      headline: string;
      keywords: string[];
      fieldOfScience: string[];
      language?: string[];
      country?: string[];
      datePublished: string;
      citeAs?: string;
      conformsTo?: string;
      dataLocations: Array<{ kind: number; location: string }>;
    }): Promise<string> => {
      // Send exact path from upload – backend resolves it internally.
      const dataLocationsMapped = payload.dataLocations.map((d) => ({
        Kind: d.kind,
        Location: (d.location ?? "").trim(),
      }));

      const buildOnboardPayload = (
        dataLocations: Array<{ Kind: number; Location: string }>,
      ) => ({
        code: payload.code,
        name: payload.name,
        Description: payload.description,
        License: payload.license,
        MimeType: payload.mimeType,
        Size: payload.size,
        Url: payload.url ?? "",
        Version: payload.version ?? "",
        Headline: payload.headline,
        Keywords: payload.keywords,
        FieldOfScience: payload.fieldOfScience,
        Language: payload.language ?? [],
        Country: payload.country ?? [],
        DatePublished: payload.datePublished,
        CiteAs: payload.citeAs ?? "",
        ConformsTo: payload.conformsTo ?? "",
        DataLocations: dataLocations,
      });

      const apiPayload = buildOnboardPayload(dataLocationsMapped);

      logApiRequest("onboardDataset", {
        endpoint: "/dataset/onboard",
        DataLocations: dataLocationsMapped,
      });

      const response = await makeRequest("/dataset/onboard", {
        method: "POST",
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        const locationValidationError =
          Array.isArray((errorData as { message?: unknown }).message) &&
          (errorData as { message: Array<{ Key?: string }> }).message.some(
            (entry) => entry?.Key?.includes("DataLocations"),
          );

        if (locationValidationError) {
          const candidates = [
            dataLocationsMapped.map((d) => ({
              ...d,
              Location: d.Location.replace(
                "/s3/gw-service/",
                "/storage/datagems/gw/",
              ),
            })),
          ];

          for (const candidate of candidates) {
            const sameAsOriginal = candidate.every(
              (value, idx) =>
                value.Location === dataLocationsMapped[idx]?.Location,
            );
            if (sameAsOriginal) continue;

            const retryResponse = await makeRequest("/dataset/onboard", {
              method: "POST",
              body: JSON.stringify(buildOnboardPayload(candidate)),
            });
            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              const retryDatasetId =
                typeof retryResult === "string"
                  ? retryResult
                  : (retryResult?.id ?? "");
              logApiResponse("onboardDataset", {
                datasetId: retryDatasetId,
                recoveredWithLocationFallback: true,
              });
              return retryDatasetId;
            }
          }
        }

        logApiError("onboardDataset", errorData);
        throw new Error(
          (errorData as { error?: string }).error ||
            ApiErrorMessage.ONBOARD_DATASET_FAILED,
        );
      }

      const result = await response.json();
      const datasetId =
        typeof result === "string" ? result : (result?.id ?? "");
      logApiResponse("onboardDataset", { datasetId });
      return datasetId;
    },
    [makeRequest],
  );

  const getLinguisticFeatures = useCallback(
    async (payload: { DatasetIds: string[]; Query: string }): Promise<any> => {
      logApiRequest("getLinguisticFeatures", {
        endpoint: "/pilot/language/linguistic-features",
        payload,
      });
      const response = await makeRequest(
        "/pilot/language/linguistic-features",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("getLinguisticFeatures", errorData);
        throw new Error(
          errorData.error ||
            errorData.message ||
            "Failed to get linguistic features",
        );
      }
      const result = await response.json();
      logApiResponse("getLinguisticFeatures", result);
      return result;
    },
    [makeRequest],
  );

  const profileDataset = useCallback(
    async (datasetId: string, dataStoreKind: number): Promise<string> => {
      logApiRequest("profileDataset", {
        endpoint: "/dataset/profile",
        datasetId,
      });
      const response = await makeRequest("/dataset/profile", {
        method: "POST",
        body: JSON.stringify({ id: datasetId, dataStoreKind }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logApiError("profileDataset", errorData);
        throw new Error(
          errorData.error || ApiErrorMessage.PROFILE_DATASET_FAILED,
        );
      }
      const result = await response.json();
      const id =
        typeof result === "string" ? result : (result?.id ?? datasetId);
      logApiResponse("profileDataset", { datasetId: id });
      return id;
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
    getDatasetById,
    downloadDatasetFile,
    getDatasetRecommendations,
    getUserFavorites,
    addFavoriteDataset,
    removeFavoriteDataset,
    getCollectionGrants,
    grantCollectionPermission,
    deleteCollection,
    getCurrentUserContextGrants,
    getUserDatasetGrants,
    getGroupDatasetGrants,
    getUserCollectionGrants,
    getGroupCollectionGrants,
    assignUserDatasetGrant,
    unassignUserDatasetGrant,
    assignGroupDatasetGrant,
    unassignGroupDatasetGrant,
    assignUserCollectionGrant,
    unassignUserCollectionGrant,
    assignGroupCollectionGrant,
    unassignGroupCollectionGrant,
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
    queryUsers,
    queryUserGroups,
    getUserSettings,
    getUserSettingsByKey,
    getUserSettingsById,
    deleteUserSettingsById,
    deleteUserSettingsByKey,
    saveUserSettings,
    getRecommendNextQueries,
    getUploadAllowedExtensions,
    uploadDatasetFiles,
    onboardDataset,
    profileDataset,
    getLinguisticFeatures,
  };
}
