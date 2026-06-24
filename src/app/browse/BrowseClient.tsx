"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { APP_ROUTES } from "@/config/appUrls";
import {
  convertToBackendFilters,
  type FilterState,
} from "@/config/filterOptions";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Collection, Dataset, DatasetPlus } from "@/data/dataset";
import { mockPackages } from "@/data/package";
import { useApi } from "@/hooks/useApi";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { mapApiDatasetToDataset } from "@/lib/datasetMapping";
import { sortDatasetsWithSecondaryRules } from "@/lib/datasetSorting";
import { logDebug, logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
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
      "datasets.id",
      "datasets.code",
      "datasets.name",
      "datasets.description",
      "datasets.license",
      "datasets.mimeType",
      "datasets.url",
      "datasets.version",
      "datasets.fieldOfScience",
      "datasets.keywords",
      "datasets.size",
      "datasets.datePublished",
      "datasets.collections.id",
      "datasets.collections.code",
      "datasets.collections.name",
      "datasets.collections.datasetCount",
      "datasets.permissions",
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

function _mapUserCollectionToDatasets(userCollection: unknown): DatasetPlus[] {
  if (typeof userCollection !== "object" || userCollection === null) {
    return [];
  }

  const obj = userCollection as Record<string, unknown>;
  const datasets = Array.isArray(obj.datasets) ? obj.datasets : [];

  const byId = new Map<string, DatasetPlus>();

  datasets.forEach((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const dataset = item as Record<string, unknown>;
    const id = String(dataset.id ?? "");

    if (!id || byId.has(id)) {
      return;
    }

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
            (c): c is { id: string; name: string; code: string } => c !== null,
          )
      : [];

    const permissions = Array.isArray(dataset.permissions)
      ? dataset.permissions
      : [];
    const access = permissions.includes("browsedataset")
      ? "Open Access"
      : "Restricted";

    byId.set(id, {
      id,
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
      fieldOfScience: Array.isArray(dataset.fieldOfScience)
        ? dataset.fieldOfScience.map(String)
        : undefined,
      license: String(dataset.license ?? ""),
      mimeType: String(dataset.mimeType ?? ""),
      url: String(dataset.url ?? ""),
      version: String(dataset.version ?? ""),
    });
  });

  return Array.from(byId.values());
}

export default function BrowseClient() {
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
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const {
    apiCollections,
    extraCollections,
    refreshExtraCollections,
    notifyCollectionModified,
  } = useCollections();

  const collectionDisplayName = React.useMemo(() => {
    if (!selectedCollection) return null;
    const list: ApiCollection[] = isCustomCollection
      ? extraCollections
      : apiCollections;
    const found = list.find(
      (c: ApiCollection) => String(c.id) === String(selectedCollection),
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

        if (
          !selectedCollection &&
          isSmartSearchEnabled &&
          searchTerm.trim().length >= 3
        ) {
          try {
            const persistPayload = { name: searchTerm };
            const persistData = await api.persistConversation(
              persistPayload,
              "?f=id&f=etag",
            );
            const conversationIdFromPersist = persistData.id;

            if (!conversationIdFromPersist) {
              throw new Error("No conversation ID returned from server.");
            }

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
                  "hits.content",
                  "hits.objectId",
                  "hits.similarity",
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

            const data = await api.searchCrossDataset(crossDatasetPayload);

            const results = Array.isArray(data.result) ? data.result : [];

            const byId = new Map<string, DatasetPlus>();
            for (const item of results) {
              const ds = (item as any)?.dataset || {};
              if (!ds || typeof ds !== "object") continue;
              const id = String(ds.id ?? "");
              const maxSimilarity =
                typeof item.maxSimilarity === "number"
                  ? item.maxSimilarity
                  : undefined;

              const rawHits = Array.isArray((item as any).hits)
                ? (item as any).hits
                : [];
              const topHits = rawHits.slice(0, 3);
              const hits = topHits.map((h: any, idx: number) => {
                const text =
                  h && typeof h === "object" && ("content" in h || "text" in h)
                    ? String(h.content ?? h.text ?? "")
                    : String(h ?? "");
                const similarity =
                  h && typeof h === "object" && typeof h.similarity === "number"
                    ? h.similarity
                    : typeof h === "object" &&
                        typeof h.maxSimilarity === "number"
                      ? h.maxSimilarity
                      : 0;
                const number =
                  h && typeof h === "object" && typeof h.number === "number"
                    ? h.number
                    : idx;
                return { number, text, similarity };
              });

              if (!id || byId.has(id)) continue;

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
                    f.includes("weather"),
                )
              ) {
                category = "Weather";
              } else if (
                fields.some(
                  (f: any) =>
                    f.includes("language") || f.includes("linguistics"),
                )
              ) {
                category = "Language";
              } else if (
                fields.some(
                  (f: any) => f.includes("education") || f.includes("learning"),
                )
              ) {
                category = "Lifelong Learning";
              } else if (
                fields.some(
                  (f: any) =>
                    f.includes("mathematics") || f.includes("statistics"),
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
                        : null,
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
                hits,
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
            logError("Smart search failed, falling back", smartErr);
          }
        }

        if (selectedCollection && isCustomCollection) {
          const payload = {
            ...USER_COLLECTION_API_PAYLOAD,
            ids: [selectedCollection],
          };

          const data = await api.queryUserCollections(payload);
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length > 0) {
            const collection = items[0];
            const datasets = Array.isArray(collection.datasets)
              ? collection.datasets
              : [];

            const datasetIds = datasets
              .map((dataset: unknown) => {
                if (
                  typeof dataset === "object" &&
                  dataset !== null &&
                  "id" in dataset
                ) {
                  return typeof (dataset as Record<string, unknown>).id ===
                    "string"
                    ? (dataset as Record<string, unknown>).id
                    : null;
                }
                return null;
              })
              .filter((id: any): id is string => id !== null);

            if (datasetIds.length > 0) {
              try {
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

                const datasetData = await api.queryDatasets(datasetPayload);
                const datasets = Array.isArray(datasetData.items)
                  ? datasetData.items
                  : [];

                const byId = new Map<string, DatasetPlus>();

                datasets.forEach((apiDataset: any) => {
                  const id = String(apiDataset.id ?? "");

                  if (!id || byId.has(id)) {
                    return;
                  }

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
                      String(f).toLowerCase(),
                    );
                    if (
                      fields.some(
                        (field: any) =>
                          field.includes("meteorology") ||
                          field.includes("climate") ||
                          field.includes("weather"),
                      )
                    ) {
                      category = "Weather";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("language") ||
                          field.includes("linguistics"),
                      )
                    ) {
                      category = "Language";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("education") ||
                          field.includes("learning"),
                      )
                    ) {
                      category = "Lifelong Learning";
                    } else if (
                      fields.some(
                        (field: any) =>
                          field.includes("mathematics") ||
                          field.includes("statistics"),
                      )
                    ) {
                      category = "Math";
                    }
                  }

                  byId.set(id, {
                    id,
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
                  });
                });

                const uniqueDatasets = Array.from(byId.values());
                setAllDatasets(uniqueDatasets);
              } catch (error) {
                logError("Failed to fetch dataset details", error);
                setError(ApiErrorMessage.FETCH_DATASET_DETAILS_FAILED);
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

        let payload: any = { ...API_PAYLOAD };

        let orderField = "name";
        let orderDir = "+";
        if (sortBy.startsWith("name")) orderField = "name";
        else if (sortBy.startsWith("size")) orderField = "size";
        else if (sortBy.startsWith("datePublished"))
          orderField = "datePublished";
        if (sortBy.endsWith("desc")) orderDir = "-";
        payload.Order = { Items: [orderDir + orderField] };

        if (searchTerm.length >= 3) {
          payload = {
            ...payload,
            like: `%${searchTerm}%`,
          };
        }

        const backendFilters = convertToBackendFilters(filters);

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

          if (Object.keys(sizeRange).length > 0) {
            payload.sizeRange = sizeRange;
          }
        }

        const data = await api.queryDatasets(payload);
        const items = Array.isArray(data.items) ? data.items : [];
        const mappedDatasets = items.map(mapApiDatasetToDataset);
        const sortedDatasets = sortDatasetsWithSecondaryRules(
          mappedDatasets,
          sortBy,
        );
        setAllDatasets(sortedDatasets);
      } catch (err: unknown) {
        let message: string = ApiErrorMessage.UNEXPECTED_ERROR;
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

  useEffect(() => {
    let datasetsToSet: DatasetPlus[] = [];

    if (selectedCollection && allDatasets.length > 0) {
      if (isCustomCollection) {
        datasetsToSet = allDatasets;
      } else {
        datasetsToSet = allDatasets.filter(
          (
            dataset: Dataset & {
              collections?: { id: string; name: string; code: string }[];
            },
          ) => {
            return dataset.collections?.some(
              (col) => col.id === selectedCollection,
            );
          },
        );
      }
    } else {
      datasetsToSet = allDatasets;
    }

    const byId = new Map<string, DatasetPlus>();
    datasetsToSet.forEach((dataset) => {
      if (dataset.id && !byId.has(dataset.id)) {
        byId.set(dataset.id, dataset);
      }
    });

    const uniqueFiltered = Array.from(byId.values());
    setFilteredDatasets(uniqueFiltered);
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
    [pendingSearchTerm],
  );

  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    logDebug("Session info", {
      hasToken: api.hasToken,
    });
  }, [api.hasToken]);

  useEffect(() => {
    setPendingSearchTerm("");
    setSearchTerm("");
  }, [pathname]);

  useEffect(() => {
    if (selectedCollection) {
      setPendingSearchTerm("");
      setSearchTerm("");
    }
  }, [selectedCollection]);

  useEffect(() => {
    if (isMounted) {
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [isMounted]);

  const handlePackageSelect = useCallback((packageId: string) => {
    const pkg = mockPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      pkg.datasetIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
    setSelectedPackageIds((prev) =>
      prev.includes(packageId) ? prev : [...prev, packageId],
    );
    setShowSelectedPanel(true);
  }, []);

  const handlePackageDeselect = useCallback((packageId: string) => {
    const pkg = mockPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedDatasets((prev) =>
      prev.filter((id) => !pkg.datasetIds.includes(id)),
    );
    setSelectedPackageIds((prev) => prev.filter((id) => id !== packageId));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedDatasets([]);
    setSelectedPackageIds([]);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setShowSelectedPanel(false);
  }, []);

  const handleReopenSidebar = useCallback(() => {
    setShowSelectedPanel(true);
  }, []);

  const handleChatWithData = useCallback(() => {
    if (isMounted) {
      localStorage.setItem(
        "chatSelectedDatasets",
        JSON.stringify(selectedDatasets),
      );
    }
    router.push(getNavigationUrl(APP_ROUTES.CHAT));
  }, [router, isMounted, selectedDatasets]);

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
          selectedPackageIds={selectedPackageIds}
          onPackageSelect={handlePackageSelect}
          onPackageDeselect={handlePackageDeselect}
          onDeselectAll={handleDeselectAll}
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
