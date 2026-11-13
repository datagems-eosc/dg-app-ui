import { useCallback, useEffect, useRef, useState } from "react";
import {
  convertToBackendFilters,
  type FilterState,
  getDefaultFilters,
} from "@/config/filterOptions";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import {
  CATALOGUE_PAGE_SIZE,
  useCataloguePaging,
} from "@/hooks/useCataloguePaging";
import { ApiErrorMessage } from "@/lib/apiErrors";
import {
  mapApiDatasetToDataset,
  mapDiscoveryResults,
} from "@/lib/datasetMapping";
import { sortDatasetsWithSecondaryRules } from "@/lib/datasetSorting";
import { logError } from "@/lib/logger";

export const DEFAULT_SORT = "name-asc";

/** What the list covers: the catalogue, one built-in collection, or one of the user's collections. */
export type DatasetSearchScope =
  | { kind: "all" }
  | { kind: "collection"; id: string }
  | { kind: "custom"; id: string };

/** A Home handoff's hold on the first search (`useBrowseHandoff`). */
export interface DatasetSearchHandoff {
  initialText: string;
  startsSmart: boolean;
  smartQueryFor: (term: string) => string;
  isRepeatedStart: (term: string, inputs: unknown[]) => boolean;
}

const NO_HANDOFF: DatasetSearchHandoff = {
  initialText: "",
  startsSmart: false,
  smartQueryFor: (term) => term,
  isRepeatedStart: () => false,
};

const DATASET_FIELDS = [
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
];

const CATALOGUE_PAYLOAD = {
  project: { fields: DATASET_FIELDS },
  page: { Offset: 0, Size: CATALOGUE_PAGE_SIZE },
  Order: { Items: ["+code"] },
  Metadata: { CountAll: true },
};

const USER_COLLECTION_PAYLOAD = {
  project: { fields: ["id", "name", "datasets.id"] },
  page: { Offset: 0, Size: 100 },
  Order: { Items: ["-createdAt"] },
  Metadata: { CountAll: true },
};

const SMART_FIELDS = [
  "conversationId",
  "content",
  "useCase",
  ...DATASET_FIELDS.map((field) => `dataset.${field}`),
  "dataset.profileRaw",
  "hits.content",
  "hits.objectId",
  "hits.similarity",
  "sourceId",
  "chunkId",
  "language",
  "distance",
  "maxSimilarity",
];

const orderFor = (sort: string) => {
  let field = "name";
  if (sort.startsWith("size")) field = "size";
  else if (sort.startsWith("datePublished")) field = "datePublished";
  return { Items: [(sort.endsWith("desc") ? "-" : "+") + field] };
};

/** The catalogue request for the current search, sort and filters. */
function cataloguePayload(
  searchTerm: string,
  sort: string,
  filters: FilterState | null,
  collectionId: string | null,
) {
  const payload: Record<string, unknown> = {
    ...CATALOGUE_PAYLOAD,
    Order: orderFor(sort),
  };
  // Sent unescaped: the dataset `like` on dev ignores backslash escapes, so
  // `%` and `_` stay wildcards (known bug).
  if (searchTerm.length >= 3) payload.like = `%${searchTerm}%`;
  // A built-in collection is filtered by the Gateway, so its count and paging
  // cover the whole collection, not one catalogue page.
  if (collectionId) payload.collectionIds = [collectionId];

  const backend = filters ? convertToBackendFilters(filters) : {};
  if (backend.license && backend.license.length > 0) {
    payload.license = backend.license.join(",");
  }
  if (backend.fieldsOfScience && backend.fieldsOfScience.length > 0) {
    payload.fieldsOfScience = backend.fieldsOfScience;
  }
  if (
    backend.publishedRange &&
    (backend.publishedRange.start || backend.publishedRange.end)
  ) {
    payload.publishedRange = backend.publishedRange;
  }
  if (backend.sizeRange) {
    const sizeRange: Record<string, number> = {};
    if (backend.sizeRange.start && backend.sizeRange.start > 0) {
      sizeRange.start = backend.sizeRange.start;
    }
    if (backend.sizeRange.end && backend.sizeRange.end > 0) {
      sizeRange.end = backend.sizeRange.end;
    }
    if (Object.keys(sizeRange).length > 0) payload.sizeRange = sizeRange;
  }
  return payload;
}

const idsOf = (datasets: unknown): string[] =>
  (Array.isArray(datasets) ? datasets : [])
    .map((d) =>
      typeof d === "object" && d !== null
        ? (d as Record<string, unknown>).id
        : null,
    )
    .filter((id): id is string => typeof id === "string");

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (item.id && !byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
};

interface DatasetSearchOptions {
  /** `null` while the scope is unknown: nothing is requested until it is. */
  scope: DatasetSearchScope | null;
  handoff?: DatasetSearchHandoff;
}

/**
 * Search state and requests for a dataset list (Datasets, use-case pages):
 * the text in the box and the submitted search, sort, filters, Smart mode,
 * "Load more" paging, loading and errors. Only the latest request may update
 * the list.
 */
export function useDatasetSearch({
  scope,
  handoff = NO_HANDOFF,
}: DatasetSearchOptions) {
  const { hasToken, queryDatasets, queryUserCollections, searchCrossDataset } =
    useApi();
  const scopeKind = scope?.kind ?? null;
  const scopeId = scope && scope.kind !== "all" ? scope.id : null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetPlus[]>([]);
  const [searchTerm, setSearchTerm] = useState(handoff.initialText);
  const [pendingSearchTerm, setPendingSearchTerm] = useState(
    handoff.initialText,
  );
  // Counts explicit searches, so submitting the same text searches again.
  const [searchRun, setSearchRun] = useState(0);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);
  const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(
    handoff.startsSmart,
  );

  // Opening another collection starts with an empty box. A scope that only
  // now became known (a use-case page waiting for its collection) keeps what
  // was typed meanwhile.
  const [shownScope, setShownScope] = useState({
    kind: scopeKind,
    id: scopeId,
  });
  if (shownScope.id !== scopeId || shownScope.kind !== scopeKind) {
    setShownScope({ kind: scopeKind, id: scopeId });
    if (scopeId && shownScope.kind !== null) {
      setPendingSearchTerm("");
      setSearchTerm("");
    }
  }

  // Only the latest list request (new search/sort/filter or load more) may
  // update the list.
  const listRequest = useRef(0);
  // The catalogue request behind the list on screen, and whether the next
  // search comes only from switching Smart search.
  const shownCatalogue = useRef<string | null>(null);
  const toggled = useRef(false);
  const appendCataloguePage = useCallback((items: unknown[], sort: string) => {
    const next: DatasetPlus[] = items.map(mapApiDatasetToDataset);
    setDatasets((prev) => {
      const seen = new Set(prev.map((d) => d.id));
      return sortDatasetsWithSecondaryRules(
        [...prev, ...next.filter((d) => !seen.has(d.id))],
        sort,
      );
    });
  }, []);
  const paging = useCataloguePaging({
    listRequest,
    query: queryDatasets,
    appendPage: appendCataloguePage,
  });
  const { reset: resetPaging, start: startPaging } = paging;

  useEffect(() => {
    if (!scopeKind) return;
    if (
      searchRun === 0 &&
      isSmartSearchEnabled &&
      hasToken &&
      handoff.isRepeatedStart(searchTerm, [
        searchTerm,
        sortBy,
        filters,
        scopeKind,
        scopeId,
      ])
    ) {
      return;
    }
    // A Home handoff shows the user's text but discovers with the
    // classifier's retrieval query, unless that is too short to search.
    const retrieval = handoff.smartQueryFor(searchTerm);
    const smartQuery = retrieval.trim().length >= 3 ? retrieval : searchTerm;

    const listSmart = async (request: number) => {
      try {
        // A dataset search is not a chat: run discovery untracked (no
        // conversation id, no auto-create) so it never shows up in Recent
        // Chats.
        const collectionId =
          scopeKind === "collection" && scopeId ? scopeId : null;
        const data = await searchCrossDataset({
          conversationOptions: { autoCreateConversation: false },
          project: { fields: SMART_FIELDS },
          query: smartQuery,
          resultCount: 100,
          // A built-in collection limits discovery to its datasets.
          ...(collectionId ? { collectionIds: [collectionId] } : {}),
        });
        if (request !== listRequest.current) return;
        const found = mapDiscoveryResults(
          Array.isArray(data.result) ? data.result : [],
        );
        // Dev discovery also returns datasets outside the requested
        // collection (known bug), so keep only the collection's own.
        setDatasets(
          collectionId
            ? found.filter((d) =>
                d.collections?.some((c) => c.id === collectionId),
              )
            : found,
        );
      } catch (smartErr) {
        if (request !== listRequest.current) return;
        // A name search on a whole sentence would only show "no results".
        logError("Smart search failed", smartErr);
        setError(ApiErrorMessage.SMART_SEARCH_FAILED);
      }
    };

    const listCustom = async (request: number, collectionId: string) => {
      const data = await queryUserCollections({
        ...USER_COLLECTION_PAYLOAD,
        ids: [collectionId],
      });
      if (request !== listRequest.current) return;
      const items = Array.isArray(data.items) ? data.items : [];
      const datasetIds = idsOf(items[0]?.datasets);
      if (datasetIds.length === 0) {
        setDatasets([]);
        return;
      }
      try {
        const details = await queryDatasets({
          project: { fields: DATASET_FIELDS },
          ids: datasetIds,
          page: { Offset: 0, Size: 100 },
          Order: { Items: ["+code"] },
          Metadata: { CountAll: true },
        });
        if (request !== listRequest.current) return;
        const found = Array.isArray(details.items) ? details.items : [];
        setDatasets(uniqueById(found.map(mapApiDatasetToDataset)));
      } catch (detailsErr) {
        if (request !== listRequest.current) return;
        logError("Failed to fetch dataset details", detailsErr);
        setError(ApiErrorMessage.FETCH_DATASET_DETAILS_FAILED);
        setDatasets([]);
      }
    };

    // Smart search hides sort and filters, so the catalogue it lists must
    // not be sorted or filtered by them either.
    const listSort = isSmartSearchEnabled ? DEFAULT_SORT : sortBy;
    const payload = cataloguePayload(
      searchTerm,
      listSort,
      isSmartSearchEnabled ? null : filters,
      scopeKind === "collection" ? scopeId : null,
    );
    const catalogueKey = JSON.stringify([scopeKind, scopeId, payload]);

    const listCatalogue = async (request: number) => {
      const data = await queryDatasets(payload);
      if (request !== listRequest.current) return;
      const items = Array.isArray(data.items) ? data.items : [];
      setDatasets(
        sortDatasetsWithSecondaryRules(
          items.map(mapApiDatasetToDataset),
          listSort,
        ),
      );
      startPaging(payload, listSort, items.length, data.count);
      shownCatalogue.current = catalogueKey;
    };

    const path =
      scopeKind !== "custom" &&
      isSmartSearchEnabled &&
      smartQuery.trim().length >= 3
        ? "smart"
        : scopeKind === "custom" && scopeId
          ? "custom"
          : "catalogue";

    // Switching Smart search alone must not ask again for the catalogue list
    // already on screen.
    const onlyToggled = toggled.current;
    toggled.current = false;
    if (
      onlyToggled &&
      path === "catalogue" &&
      shownCatalogue.current === catalogueKey
    ) {
      return;
    }

    const run = async () => {
      const request = ++listRequest.current;
      shownCatalogue.current = null;
      setIsLoading(true);
      setError(null);
      resetPaging();
      try {
        if (!hasToken) {
          setError(ApiErrorMessage.NO_AUTH_TOKEN_FOUND);
          return;
        }
        if (path === "smart") {
          await listSmart(request);
        } else if (path === "custom" && scopeId) {
          await listCustom(request, scopeId);
        } else {
          await listCatalogue(request);
        }
      } catch (err: unknown) {
        if (request !== listRequest.current) return;
        // The Gateway's own error text stays in the log, not on the page.
        logError("Failed to list datasets", err);
        setError(ApiErrorMessage.FETCH_DATASETS_FAILED);
      } finally {
        if (request === listRequest.current) setIsLoading(false);
      }
    };
    void run();
    // The handoff helpers and API calls are stable; the inputs below decide
    // when to search.
  }, [
    hasToken,
    scopeKind,
    scopeId,
    searchTerm,
    searchRun,
    sortBy,
    filters,
    isSmartSearchEnabled,
  ]);

  const handleSearchTermSubmit = useCallback(
    (searchValue?: string) => {
      const value = (
        searchValue !== undefined ? searchValue : pendingSearchTerm
      ).trim();
      // Emptying a box that was never searched leaves the list as it is.
      if (value === "" && searchTerm === "") return;
      setSearchTerm(value);
      setSearchRun((run) => run + 1);
    },
    [pendingSearchTerm, searchTerm],
  );

  // Switching the mode searches the text the user sees in the box.
  const handleSmartSearchToggle = useCallback(
    (enabled: boolean) => {
      toggled.current = true;
      setSearchTerm(pendingSearchTerm.trim());
      setSearchRun((run) => run + 1);
      setIsSmartSearchEnabled(enabled);
    },
    [pendingSearchTerm],
  );

  return {
    datasets,
    isLoading,
    error,
    pendingSearchTerm,
    onSearchTermChange: setPendingSearchTerm,
    onSearchTermSubmit: handleSearchTermSubmit,
    /** Under 3 characters nothing is searched. */
    appliedSearchTerm: searchTerm.length >= 3 ? searchTerm : "",
    sortBy,
    onSortByChange: setSortBy,
    filters,
    onApplyFilters: setFilters,
    isSmartSearchEnabled,
    onSmartSearchToggle: handleSmartSearchToggle,
    totalCount: paging.total > 0 ? paging.total : undefined,
    hasMore: paging.hasMore,
    isLoadingMore: paging.isLoadingMore,
    onLoadMore: paging.loadMore,
    loadMoreError: paging.loadMoreError,
  };
}
