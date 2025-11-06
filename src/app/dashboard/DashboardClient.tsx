"use client";

import DashboardLayout from "@/components/DashboardLayout";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import { Collection, Dataset, DatasetPlus } from "@/data/dataset";
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { convertToBackendFilters, FilterState } from "@/config/filterOptions";
import { getNavigationUrl } from "@/lib/utils";
import { useCollections } from "@/contexts/CollectionsContext";
import { useApi } from "@/hooks/useApi";
import type { ApiCollection } from "@/types/collection";

const API_PAYLOAD = {
  project: {
    fields: [
      "id",
      "code",
      "name",
      "description",
      "license",
      "mimeType",
      "url",
      "version",
      "fieldOfScience",
      "keywords",
      "size",
      "datePublished",
      "collections.id",
      "collections.code",
      "collections.name",
      "collections.datasetCount",
      "permissions.browseDataset",
      "permissions.editDataset",
    ],
  },
  page: {
    Offset: 0,
    Size: 100,
  },
  Order: {
    Items: ["+code"],
  },
  Metadata: {
    CountAll: true,
  },
};

const USER_COLLECTION_API_PAYLOAD = {
  project: {
    fields: [
      "id",
      "name",
      "user.id",
      "user.name",
      "userDatasetCollections.id",
      "userDatasetCollections.dataset.id",
      "userDatasetCollections.dataset.code",
      "userDatasetCollections.dataset.name",
      "userDatasetCollections.dataset.description",
      "userDatasetCollections.dataset.license",
      "userDatasetCollections.dataset.mimeType",
      "userDatasetCollections.dataset.url",
      "userDatasetCollections.dataset.version",
      "userDatasetCollections.dataset.fieldOfScience",
      "userDatasetCollections.dataset.keywords",
      "userDatasetCollections.dataset.size",
      "userDatasetCollections.dataset.datePublished",
      "userDatasetCollections.dataset.collections.id",
      "userDatasetCollections.dataset.collections.code",
      "userDatasetCollections.dataset.collections.name",
      "userDatasetCollections.dataset.collections.datasetCount",
      "userDatasetCollections.dataset.permissions.browseDataset",
      "userDatasetCollections.dataset.permissions.editDataset",
    ],
  },
  page: {
    Offset: 0,
    Size: 100,
  },
  Order: {
    Items: ["-createdAt"],
  },
  Metadata: {
    CountAll: true,
  },
};

function mapApiDatasetToDataset(api: unknown): Dataset & {
  collections?: Collection[];
  license?: string;
  mimeType?: string;
  fieldsOfScience?: string[];
  size?: string;
  datePublished?: string;
} {
  if (typeof api !== "object" || api === null) {
    return {
      id: "",
      title: "Untitled",
      category: "Math",
      access: "Restricted",
      description: "",
      size: "N/A",
      lastUpdated: "2024-01-01",
      tags: [], // Provide empty array for tags
      collections: [],
      license: undefined,
      mimeType: undefined,
      fieldsOfScience: undefined,
      datePublished: undefined,
      keywords: undefined,
    };
  }
  const obj = api as Record<string, unknown>;
  const collections: Collection[] = Array.isArray(obj.collections)
    ? obj.collections
      .map((c) =>
        typeof c === "object" && c !== null && "name" in c && "id" in c
          ? {
            id: String((c as Record<string, unknown>).id ?? ""),
            name: String((c as Record<string, unknown>).name),
            code: String((c as Record<string, unknown>).code ?? ""),
          }
          : undefined
      )
      .filter(
        (c): c is Collection =>
          !!c && typeof c.id === "string" && typeof c.name === "string"
      )
    : [];

  // Handle fieldsOfScience - could be string or array
  let fieldOfScience: string[] | undefined;
  if (obj.fieldOfScience) {
    if (Array.isArray(obj.fieldOfScience)) {
      fieldOfScience = obj.fieldOfScience.map(String);
    } else if (typeof obj.fieldOfScience === "string") {
      fieldOfScience = [obj.fieldOfScience];
    }
  }

  let keywords: string[] | undefined;
  if (obj.keywords) {
    if (Array.isArray(obj.keywords)) {
      keywords = obj.keywords.map(String);
    } else if (typeof obj.keywords === "string") {
      keywords = [obj.keywords];
    }
  }

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: "Math", // fallback only
    access:
      Array.isArray(obj.permissions) &&
        obj.permissions.includes("browsedataset")
        ? "Open Access"
        : "Restricted",
    description: String(obj.description ?? ""),
    size: obj.size ? String(obj.size) : "N/A",
    lastUpdated: obj.datePublished ? String(obj.datePublished) : "2024-01-01",
    tags: [], // Provide empty array for tags
    collections,
    license: obj.license ? String(obj.license) : undefined,
    mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
    fieldOfScience,
    datePublished: obj.datePublished ? String(obj.datePublished) : undefined,
    keywords,
    url: obj.url ? String(obj.url) : undefined,
  };
}

function mapUserCollectionToDatasets(userCollection: unknown): Dataset[] {
  if (typeof userCollection !== "object" || userCollection === null) {
    return [];
  }

  const obj = userCollection as Record<string, unknown>;
  const userDatasetCollections = Array.isArray(obj.userDatasetCollections)
    ? obj.userDatasetCollections
    : [];

  return userDatasetCollections.map((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      return {
        id: "",
        title: "Untitled",
        category: "Math",
        access: "Restricted",
        description: "",
        size: "N/A",
        lastUpdated: "2024-01-01",
        tags: [],
        collections: [],
        keywords: undefined,
        fieldsOfScience: undefined,
      };
    }

    const itemObj = item as Record<string, unknown>;
    const dataset = itemObj.dataset as Record<string, unknown> | undefined;

    if (!dataset) {
      return {
        id: "",
        title: "Untitled",
        category: "Math",
        access: "Restricted",
        description: "",
        size: "N/A",
        lastUpdated: "2024-01-01",
        tags: [],
        collections: [],
        keywords: undefined,
        fieldsOfScience: undefined,
      };
    }

    // Extract all available dataset fields
    const collections = Array.isArray(dataset.collections)
      ? dataset.collections
        .map((c: unknown) => {
          if (c && typeof c === "object" && "name" in c) {
            return {
              id: String((c as Record<string, unknown>).id ?? ""),
              name: String((c as Record<string, unknown>).name ?? ""),
              code: String((c as Record<string, unknown>).code ?? ""),
            };
          }
          return null;
        })
        .filter(
          (c): c is { id: string; name: string; code: string } => c !== null
        )
      : [];

    const permissions = Array.isArray(dataset.permissions)
      ? dataset.permissions
      : [];
    const access = permissions.includes("browsedataset")
      ? "Open Access"
      : "Restricted";

    return {
      id: String(dataset.id ?? ""),
      title: String(dataset.name ?? dataset.code ?? "Untitled"),
      category: "Math", // Default fallback
      access,
      description: String(dataset.description ?? ""),
      size: String(dataset.size ?? "N/A"),
      lastUpdated: String(dataset.datePublished ?? "2024-01-01"),
      tags: [],
      collections,
      keywords: Array.isArray(dataset.keywords)
        ? dataset.keywords.map(String)
        : undefined,
      fieldsOfScience: Array.isArray(dataset.fieldOfScience)
        ? dataset.fieldOfScience.map(String)
        : undefined,
      license: String(dataset.license ?? ""),
      mimeType: String(dataset.mimeType ?? ""),
      url: String(dataset.url ?? ""),
      version: String(dataset.version ?? ""),
    };
  });
}

export default function DashboardClient() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDatasets, setAllDatasets] = useState<DatasetPlus[]>([]);
  const [filteredDatasets, setFilteredDatasets] = useState<DatasetPlus[]>([]);
  const [searchTerm, setSearchTerm] = useState(""); // used for API
  const [pendingSearchTerm, setPendingSearchTerm] = useState(""); // input value
  const [sortBy, setSortBy] = useState("name-asc");
  const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(false);
  const selectedCollection = searchParams.get("collection");
  const isCustomCollection = searchParams.get("isCustom") === "true";
  const [filters, setFilters] = useState<FilterState>({
    access: "",
    creationYear: { start: "", end: "" },
    datasetSize: { start: "", end: "" },
    fieldsOfScience: [],
    license: [],
  });
  // Collections & actions (parity with /browse)
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [favoriteDatasetIds, setFavoriteDatasetIds] = useState<string[]>([]);
  const [favoritesCollectionId, setFavoritesCollectionId] =
    useState<string>("");
  const [hasFetchedFavorites, setHasFetchedFavorites] = useState(false);
  const { apiCollections, extraCollections } = useCollections();

  const collectionDisplayName = React.useMemo(() => {
    if (!selectedCollection) return null;
    const list: ApiCollection[] = isCustomCollection
      ? extraCollections
      : apiCollections;
    const found = list.find(
      (c: ApiCollection) => String(c.id) === String(selectedCollection)
    );
    return found && typeof found.name === "string"
      ? String(found.name).replace(/ Collection$/i, "")
      : null;
  }, [
    selectedCollection,
    isCustomCollection,
    apiCollections,
    extraCollections,
  ]);

  const collectionTitle = React.useMemo(() => {
    if (!selectedCollection) return null;
    const base = collectionDisplayName || "Browse";
    return /\bdatasets$/i.test(base) ? base : `${base} Datasets`;
  }, [selectedCollection, collectionDisplayName]);

  /**
   * Fetch favorites collection to get dataset IDs for favorite state
   */
  const fetchFavoritesCollection = useCallback(async () => {
    console.log("fetchFavoritesCollection called");
    try {
      if (!api.hasToken) {
        console.log("No token available for fetchFavoritesCollection");
        return;
      }

      console.log("Fetching favorites collection with token:", api.hasToken);
      const favoritesPayload = {
        project: {
          fields: ["id", "name", "userDatasetCollections.dataset.id"],
        },
        page: {
          Offset: 0,
          Size: 100,
        },
        Order: {
          Items: ["+name"],
        },
        Metadata: {
          CountAll: true,
        },
      };

      const data = await api.queryUserCollections(
        favoritesPayload
      );
      console.log("Favorites collection response:", data);
      const items = Array.isArray(data.items) ? data.items : [];
      console.log("Items from response:", items);

      // Find the "Favorites" collection
      const favoritesCollection = items.find(
        (item: any) =>
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          (item.name === "Favorites" ||
            item.name === "Favorites" ||
            item.name === "favorites" ||
            item.name === "FAVORITES" ||
            item.name.toLowerCase().includes("favorite"))
      );

      console.log("Found favorites collection:", favoritesCollection);
      console.log(
        "All collection names:",
        items.map((item: any) =>
          typeof item === "object" && item !== null && "name" in item
            ? item.name
            : "unknown"
        )
      );

      if (
        favoritesCollection &&
        "userDatasetCollections" in favoritesCollection
      ) {
        const userDatasetCollections = Array.isArray(
          favoritesCollection.userDatasetCollections
        )
          ? favoritesCollection.userDatasetCollections
          : [];

        const datasetIds = userDatasetCollections
          .map((item: any) => {
            if (
              typeof item === "object" &&
              item !== null &&
              "dataset" in item
            ) {
              const dataset = item.dataset as Record<string, unknown>;
              return typeof dataset.id === "string" ? dataset.id : null;
            }
            return null;
          })
          .filter((id: any): id is string => id !== null);

        console.log("Setting favorite dataset IDs:", datasetIds);
        setFavoriteDatasetIds(datasetIds);
        setFavoritesCollectionId(favoritesCollection.id as string);
        setHasFetchedFavorites(true);
        console.log("Setting favorites collection ID:", favoritesCollection.id);
      } else if (favoritesCollection) {
        // Favorites collection exists but is empty (no userDatasetCollections property)
        console.log("Favorites collection exists but is empty");
        setFavoriteDatasetIds([]);
        setFavoritesCollectionId(favoritesCollection.id as string);
        setHasFetchedFavorites(true);
        console.log("Setting favorites collection ID:", favoritesCollection.id);
      } else {
        console.log("No favorites collection found");
        setFavoriteDatasetIds([]);
        setFavoritesCollectionId("");
        setHasFetchedFavorites(true);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch favorites collection:", err);
      setFavoriteDatasetIds([]);
      setFavoritesCollectionId("");
      setHasFetchedFavorites(true);
    }
  }, [api.hasToken]);

  /**
   * Add dataset to favorites collection
   */
  const handleAddToFavorites = useCallback(
    async (datasetId: string) => {
      console.log("handleAddToFavorites called with datasetId:", datasetId);
      try {
        if (!api.hasToken || !favoritesCollectionId) {
          console.log("Token or favoritesCollectionId missing:", {
            hasToken: api.hasToken,
            favoritesCollectionId,
          });
          throw new Error("No authentication token or favorites collection ID");
        }

        console.log("Adding dataset to favorites collection:", {
          collectionId: favoritesCollectionId,
          datasetId,
        });

        await api.addDatasetToUserCollection(
          favoritesCollectionId,
          datasetId
        );

        console.log("Successfully added dataset to favorites, refreshing...");

        // Refresh favorites collection to update the UI
        await fetchFavoritesCollection();
      } catch (err: unknown) {
        console.error("Failed to add dataset to favorites:", err);
        throw err;
      }
    },
    [api.hasToken, favoritesCollectionId, fetchFavoritesCollection]
  );

  /**
   * Remove dataset from favorites collection
   */
  const handleRemoveFromFavorites = useCallback(
    async (datasetId: string) => {
      console.log(
        "handleRemoveFromFavorites called with datasetId:",
        datasetId
      );
      try {
        if (!api.hasToken || !favoritesCollectionId) {
          console.log("Token or favoritesCollectionId missing:", {
            hasToken: api.hasToken,
            favoritesCollectionId,
          });
          throw new Error("No authentication token or favorites collection ID");
        }

        console.log("Removing dataset from favorites collection:", {
          collectionId: favoritesCollectionId,
          datasetId,
        });

        await api.removeDatasetFromUserCollection(
          favoritesCollectionId,
          datasetId
        );

        console.log(
          "Successfully removed dataset from favorites, refreshing..."
        );

        // Refresh favorites collection to update the UI
        await fetchFavoritesCollection();

        // If we're currently viewing the favorites collection, remove the dataset from the local state
        if (
          selectedCollection === favoritesCollectionId &&
          isCustomCollection
        ) {
          console.log(
            "Removing dataset from local state since we're on favorites collection page"
          );
          setAllDatasets((prevDatasets) =>
            prevDatasets.filter((dataset) => dataset.id !== datasetId)
          );
        }
      } catch (err: unknown) {
        console.error("Failed to remove dataset from favorites:", err);
        throw err;
      }
    },
    [
      api.hasToken,
      favoritesCollectionId,
      fetchFavoritesCollection,
      selectedCollection,
      isCustomCollection,
    ]
  );

  /**
   * Fetch datasets from API. If searchTerm is at least 3 chars, add 'like' to payload.
   * Use sortBy to set the order.items field in the payload.
   * Show loader while fetching. If searchTerm is less than 3 chars, load all datasets.
   */
  useEffect(() => {
    const fetchDatasets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!api.hasToken) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }

        // Smart Search flow: use cross-dataset search like in Chat.tsx
        if (
          !selectedCollection &&
          isSmartSearchEnabled &&
          searchTerm.trim().length >= 3
        ) {
          try {
            // 1) Create a lightweight conversation to attach the search to
            const persistPayload = { name: searchTerm };
            const persistData = await api.persistConversation(
              persistPayload,
              "?f=id&f=etag"
            );
            const conversationIdFromPersist = persistData.id;

            if (!conversationIdFromPersist) {
              throw new Error("No conversation ID returned from server.");
            }

            // 2) Run cross-dataset search
            const crossDatasetPayload = {
              conversationOptions: {
                conversationId: conversationIdFromPersist,
                autoCreateConversation: false,
              },
              project: {
                fields: [
                  "conversationId",
                  "content",
                  "useCase",
                  "dataset.id",
                  "dataset.code",
                  "dataset.name",
                  "dataset.description",
                  "dataset.license",
                  "dataset.mimeType",
                  "dataset.url",
                  "dataset.version",
                  "dataset.fieldOfScience",
                  "dataset.keywords",
                  "dataset.size",
                  "dataset.datePublished",
                  "dataset.collections.id",
                  "dataset.collections.code",
                  "dataset.collections.name",
                  "dataset.collections.datasetCount",
                  "dataset.permissions.browseDataset",
                  "dataset.permissions.editDataset",
                  "dataset.profileRaw",
                  "dataset.hits.content",
                  "dataset.hits.objectId",
                  "dataset.hits.similarity",
                  "sourceId",
                  "chunkId",
                  "language",
                  "distance",
                  "maxSimilarity",
                ],
              },
              query: searchTerm,
              resultCount: 100,
            } as any;

            const data = await api.searchCrossDataset(
              crossDatasetPayload
            );

            const results = Array.isArray(data.result) ? data.result : [];

            // Map directly from cross-dataset results and deduplicate by dataset.id
            const byId = new Map<string, DatasetPlus>();
            for (const item of results) {
              const ds = (item as any)?.dataset || {};
              if (!ds || typeof ds !== "object") continue;
              const id = String(ds.id ?? "");
              const maxSimilarity = typeof item.maxSimilarity === "number" ? item.maxSimilarity : undefined;
              if (!id || byId.has(id)) continue;

              // Determine category based on fieldOfScience
              let category:
                | "Weather"
                | "Math"
                | "Lifelong Learning"
                | "Language" = "Math";
              const fields = Array.isArray(ds.fieldOfScience)
                ? ds.fieldOfScience.map((f: any) => String(f).toLowerCase())
                : [];
              if (
                fields.some(
                  (f: any) =>
                    f.includes("meteorology") ||
                    f.includes("climate") ||
                    f.includes("weather")
                )
              ) {
                category = "Weather";
              } else if (
                fields.some(
                  (f: any) => f.includes("language") || f.includes("linguistics")
                )
              ) {
                category = "Language";
              } else if (
                fields.some(
                  (f: any) => f.includes("education") || f.includes("learning")
                )
              ) {
                category = "Lifelong Learning";
              } else if (
                fields.some(
                  (f: any) => f.includes("mathematics") || f.includes("statistics")
                )
              ) {
                category = "Math";
              }

              const collections = Array.isArray(ds.collections)
                ? ds.collections
                  .map((c: any) =>
                    c && typeof c === "object" && ("name" in c || "id" in c)
                      ? {
                        id: String(c.id ?? ""),
                        name: String(c.name ?? ""),
                        code: String(c.code ?? ""),
                      }
                      : null
                  )
                  .filter((c: any) => c !== null)
                : [];

              const permissions = Array.isArray(ds.permissions)
                ? ds.permissions
                : [];
              const access = permissions.includes("browsedataset")
                ? "Open Access"
                : "Restricted";

              const mapped: DatasetPlus = {
                id,
                title: String(ds.name ?? ds.code ?? "Untitled"),
                category,
                access,
                maxSimilarity,
                description: String(ds.description ?? ""),
                size: ds.size ? String(ds.size) : "N/A",
                lastUpdated: ds.datePublished
                  ? String(ds.datePublished)
                  : "2024-01-01",
                tags: Array.isArray(ds.keywords)
                  ? ds.keywords.map((k: any) => String(k))
                  : [],
                collections,
                license: ds.license ? String(ds.license) : undefined,
                mimeType: ds.mimeType ? String(ds.mimeType) : undefined,
                fieldOfScience: Array.isArray(ds.fieldOfScience)
                  ? ds.fieldOfScience.map((f: any) => String(f))
                  : undefined,
                datePublished: ds.datePublished
                  ? String(ds.datePublished)
                  : undefined,
                keywords: Array.isArray(ds.keywords)
                  ? ds.keywords.map((k: any) => String(k))
                  : undefined,
                url: ds.url ? String(ds.url) : undefined,
                version: ds.version ? String(ds.version) : undefined,
              };
              byId.set(id, mapped);
            }

            setAllDatasets(Array.from(byId.values()));
            setIsLoading(false);
            return;
          } catch (smartErr: any) {
            console.error("Smart search failed, falling back:", smartErr);
            // Fall through to default logic below
          }
        }

        // Check if we should fetch from user collection endpoint
        if (selectedCollection && isCustomCollection) {
          // Fetch from user collection endpoint to get dataset IDs
          const payload = {
            ...USER_COLLECTION_API_PAYLOAD,
            ids: [selectedCollection],
          };

          const data = await api.queryUserCollections(payload);
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length > 0) {
            const collection = items[0];
            const userDatasetCollections = Array.isArray(
              collection.userDatasetCollections
            )
              ? collection.userDatasetCollections
              : [];

            // Extract dataset IDs from the collection
            const datasetIds = userDatasetCollections
              .map((item: unknown) => {
                if (
                  typeof item === "object" &&
                  item !== null &&
                  "dataset" in item
                ) {
                  const dataset = item.dataset as Record<string, unknown>;
                  return typeof dataset.id === "string" ? dataset.id : null;
                }
                return null;
              })
              .filter((id: any): id is string => id !== null);

            if (datasetIds.length > 0) {
              try {
                // Fetch detailed dataset information using the IDs
                const datasetPayload = {
                  project: {
                    fields: [
                      "id",
                      "code",
                      "name",
                      "description",
                      "license",
                      "mimeType",
                      "url",
                      "version",
                      "fieldOfScience",
                      "keywords",
                      "size",
                      "datePublished",
                      "collections.id",
                      "collections.code",
                      "collections.name",
                      "collections.datasetCount",
                      "permissions.browseDataset",
                      "permissions.editDataset",
                    ],
                  },
                  ids: datasetIds,
                  page: {
                    Offset: 0,
                    Size: 100,
                  },
                  Order: {
                    Items: ["+code"],
                  },
                  Metadata: {
                    CountAll: true,
                  },
                };

                const datasetData = await api.queryDatasets(
                  datasetPayload
                );
                const datasets = Array.isArray(datasetData.items)
                  ? datasetData.items
                  : [];

                // Map the detailed dataset data to our Dataset interface
                const mappedDatasets = datasets.map((apiDataset: any) => {
                  // Determine category based on fieldOfScience or other indicators
                  let category:
                    | "Weather"
                    | "Math"
                    | "Lifelong Learning"
                    | "Language" = "Math";
                  if (
                    apiDataset.fieldOfScience &&
                    Array.isArray(apiDataset.fieldOfScience)
                  ) {
                    const fields = apiDataset.fieldOfScience.map((f: any) =>
                      String(f).toLowerCase()
                    );
                    if (
                      fields.some(
                        (field: any) =>
                          field.includes("meteorology") ||
                          field.includes("climate") ||
                          field.includes("weather")
                      )
                    ) {
                      category = "Weather";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("language") ||
                          field.includes("linguistics")
                      )
                    ) {
                      category = "Language";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("education") ||
                          field.includes("learning")
                      )
                    ) {
                      category = "Lifelong Learning";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("mathematics") ||
                          field.includes("statistics")
                      )
                    ) {
                      category = "Math";
                    }
                  }

                  return {
                    id: String(apiDataset.id ?? ""),
                    title: String(apiDataset.name ?? "Untitled"),
                    category,
                    access: "Open Access", // Custom collections always show Open Access
                    description: String(apiDataset.description ?? ""),
                    size: String(apiDataset.size ?? "N/A"),
                    lastUpdated: apiDataset.datePublished
                      ? String(apiDataset.datePublished)
                      : "2024-01-01",
                    tags: Array.isArray(apiDataset.keywords)
                      ? apiDataset.keywords
                      : [],
                    keywords: Array.isArray(apiDataset.keywords)
                      ? apiDataset.keywords
                      : undefined,
                    license: apiDataset.license,
                    mimeType: apiDataset.mimeType,
                    datePublished: apiDataset.datePublished,
                    fieldOfScience: Array.isArray(apiDataset.fieldOfScience)
                      ? apiDataset.fieldOfScience
                      : undefined,
                    url: apiDataset.url,
                  };
                });
                setAllDatasets(mappedDatasets);
              } catch (error) {
                console.error("Failed to fetch dataset details:", error);
                setError("Failed to fetch dataset details. Please try again.");
                setAllDatasets([]);
              }
            } else {
              setAllDatasets([]);
            }
          } else {
            setAllDatasets([]);
          }
          setIsLoading(false);
          return;
        }

        // Regular dataset fetching logic
        let payload: any = { ...API_PAYLOAD };

        // Set order.items based on sortBy
        let orderField = "name";
        let orderDir = "+";
        if (sortBy.startsWith("name")) orderField = "name";
        else if (sortBy.startsWith("size")) orderField = "size";
        else if (sortBy.startsWith("datePublished"))
          orderField = "datePublished";
        if (sortBy.endsWith("desc")) orderDir = "-";
        payload.Order = { Items: [orderDir + orderField] };

        // Add search term if >= 3 characters
        if (searchTerm.length >= 3) {
          payload = {
            ...payload,
            like: `%${searchTerm}%`,
          };
        }

        // Convert frontend filters to backend format
        const backendFilters = convertToBackendFilters(filters);

        // Add backend filters to payload
        if (backendFilters.license && backendFilters.license.length > 0) {
          payload.license = backendFilters.license.join(",");
        }
        if (
          backendFilters.fieldsOfScience &&
          backendFilters.fieldsOfScience.length > 0
        ) {
          payload.fieldsOfScience = backendFilters.fieldsOfScience;
        }
        if (
          backendFilters.publishedRange &&
          (backendFilters.publishedRange.start ||
            backendFilters.publishedRange.end)
        ) {
          payload.publishedRange = backendFilters.publishedRange;
        }
        if (backendFilters.sizeRange) {
          // Only include properties that are defined and greater than 0
          const sizeRange: any = {};
          if (
            backendFilters.sizeRange.start !== undefined &&
            backendFilters.sizeRange.start > 0
          ) {
            sizeRange.start = backendFilters.sizeRange.start;
          }
          if (
            backendFilters.sizeRange.end !== undefined &&
            backendFilters.sizeRange.end > 0
          ) {
            sizeRange.end = backendFilters.sizeRange.end;
          }

          // Only add sizeRange to payload if it has at least one property
          if (Object.keys(sizeRange).length > 0) {
            payload.sizeRange = sizeRange;
          }
        }

        const data = await api.queryDatasets(payload);
        const items = Array.isArray(data.items) ? data.items : [];
        const mappedDatasets = items.map(mapApiDatasetToDataset);
        setAllDatasets(mappedDatasets);
      } catch (err: unknown) {
        let message = "An unexpected error occurred";
        if (err instanceof Error) message = err.message;
        else if (typeof err === "string") message = err;
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDatasets();
  }, [
    router,
    api.hasToken,
    searchTerm,
    sortBy,
    filters,
    selectedCollection,
    isCustomCollection,
    isSmartSearchEnabled,
  ]);

  // Filter datasets when selectedCollection changes (frontend filtering for collection)
  useEffect(() => {
    if (selectedCollection && allDatasets.length > 0) {
      // For custom collections, the data is already filtered by the API
      if (isCustomCollection) {
        setFilteredDatasets(allDatasets);
      } else {
        // For regular collections, filter by collection ID
        const filtered = allDatasets.filter(
          (
            dataset: Dataset & {
              collections?: { id: string; name: string; code: string }[];
            }
          ) => {
            return dataset.collections?.some(
              (col) => col.id === selectedCollection
            );
          }
        );
        setFilteredDatasets(filtered);
      }
    } else {
      setFilteredDatasets(allDatasets);
    }
  }, [selectedCollection, allDatasets, isCustomCollection]);

  const handleSearchTermChange = useCallback((value: string) => {
    setPendingSearchTerm(value);
  }, []);

  const handleSearchTermSubmit = useCallback(
    (searchValue?: string) => {
      const valueToSet =
        searchValue !== undefined ? searchValue : pendingSearchTerm.trim();
      setSearchTerm(valueToSet);
    },
    [pendingSearchTerm]
  );

  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Mount flag for safe localStorage access
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug: Log Browse props
  useEffect(() => {
    console.log("Browse props:", {
      favoriteDatasetIds,
      favoritesCollectionId,
      hasOnAddToFavorites: !!handleAddToFavorites,
    });
  }, [favoriteDatasetIds, favoritesCollectionId, handleAddToFavorites]);

  // Debug: Log session info
  useEffect(() => {
    console.log("Session info:", {
      hasToken: api.hasToken,
    });
  }, [api.hasToken]);

  // Reset search input and submitted value on route changes
  useEffect(() => {
    setPendingSearchTerm("");
    setSearchTerm("");
  }, [pathname]);

  // Also reset search when switching to a specific collection via query param
  useEffect(() => {
    if (selectedCollection) {
      setPendingSearchTerm("");
      setSearchTerm("");
    }
  }, [selectedCollection]);

  // Fetch favorites collection when token is available
  useEffect(() => {
    if (api.hasToken) {
      console.log("Token available, fetching favorites collection...");
      fetchFavoritesCollection();
    } else {
      console.log("No access token available");
    }
  }, [api.hasToken, fetchFavoritesCollection]);

  // On non-chat pages, ensure chat selection is cleared in localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [isMounted]);

  // Selected panel controls
  const handleCloseSidebar = useCallback(() => {
    setShowSelectedPanel(false);
  }, []);

  const handleReopenSidebar = useCallback(() => {
    setShowSelectedPanel(true);
  }, []);

  // Chat navigation with selected datasets
  const handleChatWithData = useCallback(() => {
    if (isMounted) {
      localStorage.setItem(
        "chatSelectedDatasets",
        JSON.stringify(selectedDatasets)
      );
    }
    router.push(getNavigationUrl("/chat"));
  }, [router, isMounted, selectedDatasets]);

  // Create collection from selected datasets
  const handleAddToCollection = useCallback(() => {
    if (selectedDatasets.length === 0) {
      alert("Please select some datasets first");
      return;
    }
    setShowCreateCollectionModal(true);
  }, [selectedDatasets]);

  return (
    <DashboardLayout>
      <div className="relative">
        <Browse
          datasets={filteredDatasets}
          title={
            selectedCollection
              ? collectionTitle || "Browse Datasets"
              : "All datasets"
          }
          subtitle={
            selectedCollection
              ? isCustomCollection
                ? "List of your datasets"
                : `Filtered by collection`
              : "List of all datasets"
          }
          showSelectAll={true}
          showAddButton={true}
          showSearchAndFilters={!selectedCollection}
          favoriteDatasetIds={favoriteDatasetIds}
          favoritesCollectionId={favoritesCollectionId}
          hasFetchedFavorites={hasFetchedFavorites}
          onAddToFavorites={handleAddToFavorites}
          onRemoveFromFavorites={handleRemoveFromFavorites}
          searchTerm={pendingSearchTerm}
          onSearchTermChange={handleSearchTermChange}
          onSearchTermSubmit={handleSearchTermSubmit}
          isLoading={isLoading}
          error={error}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          isSmartSearchEnabled={isSmartSearchEnabled}
          onSmartSearchToggle={setIsSmartSearchEnabled}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={handleChatWithData}
          onAddToCollection={handleAddToCollection}
          isCustomCollection={isCustomCollection || false}
          collectionName={
            selectedCollection && isCustomCollection
              ? collectionTitle || ""
              : ""
          }
          collectionId={
            selectedCollection && isCustomCollection ? selectedCollection : ""
          }
        />

        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          selectedDatasets={selectedDatasets}
          datasets={allDatasets}
        />
      </div>
    </DashboardLayout>
  );
}
