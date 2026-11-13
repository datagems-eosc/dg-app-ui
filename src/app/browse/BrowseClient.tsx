"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { APP_ROUTES } from "@/config/appUrls";
import {
  convertToBackendFilters,
  type FilterState,
  type UnifiedFilterState,
} from "@/config/filterOptions";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Collection, Dataset, DatasetPlus } from "@/data/dataset";
import { mockPackages } from "@/data/package";
import { useApi } from "@/hooks/useApi";
import { ApiErrorMessage } from "@/lib/apiErrors";
import {
  mapApiDatasetToDataset,
  mapDiscoveryResults,
} from "@/lib/datasetMapping";
import { sortDatasetsWithSecondaryRules } from "@/lib/datasetSorting";
import { logDebug, logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import type { ApiCollection } from "@/types/collection";
import { useBrowseHandoff } from "./useBrowseHandoff";
import { CATALOGUE_PAGE_SIZE, useCataloguePaging } from "./useCataloguePaging";

const DEFAULT_SORT = "name-asc";

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
    Size: CATALOGUE_PAGE_SIZE,
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
  // Only the latest list request (new search/sort/filter or load more) may
  // update the list.
  const listRequest = useRef(0);
  const appendCataloguePage = useCallback((items: unknown[], sort: string) => {
    const next: DatasetPlus[] = items.map(mapApiDatasetToDataset);
    setAllDatasets((prev) => {
      const seen = new Set(prev.map((d) => d.id));
      return sortDatasetsWithSecondaryRules(
        [...prev, ...next.filter((d) => !seen.has(d.id))],
        sort,
      );
    });
  }, []);
  // Only the catalogue path pages.
  const paging = useCataloguePaging({
    listRequest,
    query: api.queryDatasets,
    appendPage: appendCataloguePage,
  });
  const [filteredDatasets, setFilteredDatasets] = useState<DatasetPlus[]>([]);
  const handoff = useBrowseHandoff(
    searchParams.get("handoff"),
    pathname,
    router,
  );
  const [searchTerm, setSearchTerm] = useState(handoff.initialText); // used for API
  const [pendingSearchTerm, setPendingSearchTerm] = useState(
    handoff.initialText,
  ); // input value
  // Counts explicit searches, so submitting the same text searches again.
  const [searchRun, setSearchRun] = useState(0);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(
    handoff.startsSmart,
  );
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
    if (
      searchRun === 0 &&
      isSmartSearchEnabled &&
      api.hasToken &&
      handoff.isRepeatedStart(searchTerm, [
        searchTerm,
        sortBy,
        filters,
        selectedCollection,
        isCustomCollection,
      ])
    ) {
      return;
    }
    // A Home handoff shows the user's text but discovers with the
    // classifier's retrieval query, unless that is too short to search.
    const retrieval = handoff.smartQueryFor(searchTerm);
    const smartQuery = retrieval.trim().length >= 3 ? retrieval : searchTerm;
    const fetchDatasets = async () => {
      const request = ++listRequest.current;
      setIsLoading(true);
      setError(null);
      paging.reset();
      try {
        if (!api.hasToken) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }

        if (
          !selectedCollection &&
          isSmartSearchEnabled &&
          smartQuery.trim().length >= 3
        ) {
          try {
            // A dataset search is not a chat: run discovery untracked (no
            // conversation id, no auto-create) so it never shows up in
            // Recent Chats.
            const crossDatasetPayload = {
              conversationOptions: {
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
              query: smartQuery,
              resultCount: 100,
            } as any;

            const data = await api.searchCrossDataset(crossDatasetPayload);
            if (request !== listRequest.current) return;

            const results = Array.isArray(data.result) ? data.result : [];
            setAllDatasets(mapDiscoveryResults(results));
            setIsLoading(false);
            return;
          } catch (smartErr: any) {
            if (request !== listRequest.current) return;
            // A name search on a whole sentence would only show "no results".
            logError("Smart search failed", smartErr);
            setError(ApiErrorMessage.SMART_SEARCH_FAILED);
            return;
          }
        }

        if (selectedCollection && isCustomCollection) {
          const payload = {
            ...USER_COLLECTION_API_PAYLOAD,
            ids: [selectedCollection],
          };

          const data = await api.queryUserCollections(payload);
          if (request !== listRequest.current) return;
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
                if (request !== listRequest.current) return;
                const datasets = Array.isArray(datasetData.items)
                  ? datasetData.items
                  : [];

                const byId = new Map<string, DatasetPlus>();
                for (const dataset of datasets.map(mapApiDatasetToDataset)) {
                  if (dataset.id && !byId.has(dataset.id)) {
                    byId.set(dataset.id, dataset);
                  }
                }
                setAllDatasets(Array.from(byId.values()));
              } catch (error) {
                if (request !== listRequest.current) return;
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
          return;
        }

        let payload: any = { ...API_PAYLOAD };

        // Smart search hides sort and filters, so the catalogue it lists
        // must not be sorted or filtered by them either.
        const listSort = isSmartSearchEnabled ? DEFAULT_SORT : sortBy;
        let orderField = "name";
        let orderDir = "+";
        if (listSort.startsWith("name")) orderField = "name";
        else if (listSort.startsWith("size")) orderField = "size";
        else if (listSort.startsWith("datePublished"))
          orderField = "datePublished";
        if (listSort.endsWith("desc")) orderDir = "-";
        payload.Order = { Items: [orderDir + orderField] };

        if (searchTerm.length >= 3) {
          payload = {
            ...payload,
            like: `%${searchTerm}%`,
          };
        }

        // A built-in collection is filtered by the Gateway, so its count and
        // paging cover the whole collection, not one catalogue page.
        if (selectedCollection) {
          payload.collectionIds = [selectedCollection];
        }

        const backendFilters: UnifiedFilterState = isSmartSearchEnabled
          ? {}
          : convertToBackendFilters(filters);

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
        if (request !== listRequest.current) return;
        const items = Array.isArray(data.items) ? data.items : [];
        const mappedDatasets = items.map(mapApiDatasetToDataset);
        const sortedDatasets = sortDatasetsWithSecondaryRules(
          mappedDatasets,
          listSort,
        );
        setAllDatasets(sortedDatasets);
        paging.start(payload, listSort, items.length, data.count);
      } catch (err: unknown) {
        if (request !== listRequest.current) return;
        let message: string = ApiErrorMessage.UNEXPECTED_ERROR;
        if (err instanceof Error) message = err.message;
        else if (typeof err === "string") message = err;
        setError(message);
      } finally {
        if (request === listRequest.current) setIsLoading(false);
      }
    };
    fetchDatasets();
  }, [
    router,
    api.hasToken,
    searchTerm,
    searchRun,
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
      const valueToSet = (
        searchValue !== undefined ? searchValue : pendingSearchTerm
      ).trim();
      // Emptying a box that was never searched leaves the catalogue as it is.
      if (valueToSet === "" && searchTerm === "") return;
      setSearchTerm(valueToSet);
      setSearchRun((run) => run + 1);
    },
    [pendingSearchTerm, searchTerm],
  );

  // Switching the mode searches the text the user sees in the box.
  const handleSmartSearchToggle = useCallback(
    (enabled: boolean) => {
      setSearchTerm(pendingSearchTerm.trim());
      setSearchRun((run) => run + 1);
      setIsSmartSearchEnabled(enabled);
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

  // Reset the search when the route changes, not on the first mount: a Home
  // handoff has already initialised it.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
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

  // Browse asks for a selection first.
  const handleAddToCollection = useCallback(() => {
    setShowCreateCollectionModal(true);
  }, []);

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
          // Under 3 characters nothing is searched (see the fetch effect).
          appliedSearchTerm={searchTerm.length >= 3 ? searchTerm : ""}
          isLoading={isLoading}
          totalCount={paging.total > 0 ? paging.total : undefined}
          hasMore={paging.hasMore}
          isLoadingMore={paging.isLoadingMore}
          onLoadMore={() => void paging.loadMore()}
          loadMoreError={paging.loadMoreError}
          error={error}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          isSmartSearchEnabled={isSmartSearchEnabled}
          onSmartSearchToggle={handleSmartSearchToggle}
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
