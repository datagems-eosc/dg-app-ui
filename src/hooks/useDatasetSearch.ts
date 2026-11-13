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
  asRecord,
  mapApiDatasetToDataset,
  mapDiscoveryResults,
  uniqueById,
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
}

const NO_HANDOFF: DatasetSearchHandoff = {
  initialText: "",
  startsSmart: false,
  smartQueryFor: (term) => term,
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
    .map((d) => asRecord(d)?.id)
    .filter((id): id is string => typeof id === "string");

/**
 * Dev discovery ignores `collectionIds` and also returns datasets outside the
 * collection (known bug), so Smart results keep only the collection's own.
 * Delete once the Gateway honours the limit.
 */
const keepCollection = <T extends DatasetPlus>(found: T[], id: string) =>
  found.filter((d) => d.collections?.some((c) => c.id === id));

type SearchApi = Pick<
  ReturnType<typeof useApi>,
  "queryDatasets" | "queryUserCollections" | "searchCrossDataset"
>;

/** A list request that failed, with the message the page shows for it. */
class ListFailure extends Error {
  readonly shown: ApiErrorMessage;
  readonly logAs?: string;
  readonly reason?: unknown;

  constructor(shown: ApiErrorMessage, logAs?: string, reason?: unknown) {
    super(shown);
    this.shown = shown;
    this.logAs = logAs;
    this.reason = reason;
  }
}

async function orFail<T>(
  call: Promise<T>,
  shown: ApiErrorMessage,
  logAs: string,
): Promise<T> {
  try {
    return await call;
  } catch (err) {
    throw new ListFailure(shown, logAs, err);
  }
}

interface ListResult {
  datasets: DatasetPlus[];
  /** Present for the catalogue, which pages with "Load more". */
  page?: {
    payload: Record<string, unknown>;
    itemCount: number;
    count: unknown;
  };
}

/**
 * Smart Search. A dataset search is not a chat: discovery runs untracked (no
 * conversation id, no auto-create) so it never shows up in Recent Chats.
 */
async function loadSmart(
  api: SearchApi,
  query: string,
  collectionId: string | null,
): Promise<ListResult> {
  const data = await orFail(
    api.searchCrossDataset({
      conversationOptions: { autoCreateConversation: false },
      project: { fields: SMART_FIELDS },
      query,
      resultCount: 100,
      ...(collectionId ? { collectionIds: [collectionId] } : {}),
    }),
    // A name search on a whole sentence would only show "no results".
    ApiErrorMessage.SMART_SEARCH_FAILED,
    "Smart search failed",
  );
  const found = mapDiscoveryResults(
    Array.isArray(data.result) ? data.result : [],
  );
  return {
    datasets: collectionId ? keepCollection(found, collectionId) : found,
  };
}

/** One of the user's collections: its dataset ids, then their details. */
async function loadCustom(
  api: SearchApi,
  collectionId: string,
): Promise<ListResult> {
  const data = await api.queryUserCollections({
    ...USER_COLLECTION_PAYLOAD,
    ids: [collectionId],
  });
  const items = Array.isArray(data.items) ? data.items : [];
  const datasetIds = idsOf(items[0]?.datasets);
  if (datasetIds.length === 0) return { datasets: [] };
  const details = await orFail(
    api.queryDatasets({
      ...CATALOGUE_PAYLOAD,
      ids: datasetIds,
      page: { Offset: 0, Size: 100 },
    }),
    ApiErrorMessage.FETCH_DATASET_DETAILS_FAILED,
    "Failed to fetch dataset details",
  );
  const found = Array.isArray(details.items) ? details.items : [];
  return { datasets: uniqueById(found.map(mapApiDatasetToDataset)) };
}

/** The first catalogue page for the search, sort and filters. */
async function loadCatalogue(
  api: SearchApi,
  payload: Record<string, unknown>,
  sort: string,
): Promise<ListResult> {
  const data = await api.queryDatasets(payload);
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    datasets: sortDatasetsWithSecondaryRules(
      items.map(mapApiDatasetToDataset),
      sort,
    ),
    page: { payload, itemCount: items.length, count: data.count },
  };
}

interface DatasetSearchOptions {
  /** `null` while the scope is unknown: nothing is requested until it is. */
  scope: DatasetSearchScope | null;
  handoff?: DatasetSearchHandoff;
}

/**
 * Search state and requests for a dataset list (Datasets, use-case pages):
 * the text in the box and the submitted search, sort, filters, Smart mode,
 * "Load more" paging, loading and errors. Only the latest request may update
 * the list, and a failed request leaves an empty list behind its message.
 */
export function useDatasetSearch({
  scope,
  handoff = NO_HANDOFF,
}: DatasetSearchOptions) {
  const { hasToken, queryDatasets, queryUserCollections, searchCrossDataset } =
    useApi();
  const scopeKind = scope?.kind ?? null;
  const scopeId = scope && scope.kind !== "all" ? scope.id : null;
  const builtInCollectionId = scope?.kind === "collection" ? scope.id : null;
  const scopeKey = scope ? `${scope.kind}:${scopeId ?? ""}` : null;

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
  // was typed meanwhile. Tracks the last known scope.
  const [shownScopeKey, setShownScopeKey] = useState(scopeKey);
  if (scopeKey !== null && scopeKey !== shownScopeKey) {
    setShownScopeKey(scopeKey);
    if (scopeId && shownScopeKey !== null) {
      setPendingSearchTerm("");
      setSearchTerm("");
    }
  }

  // Only the latest list request (new search/sort/filter or load more) may
  // update the list.
  const listRequest = useRef(0);
  // The last list request started. A re-run with the same inputs (switching
  // Smart search with nothing to search, a StrictMode re-run of the Home
  // handoff) does not ask again; a failure clears it so the next try does.
  const lastStarted = useRef<string | null>(null);
  const appendCataloguePage = useCallback((items: unknown[], sort: string) => {
    const next: DatasetPlus[] = items.map(mapApiDatasetToDataset);
    // Everything already listed stays; only rows listed before are skipped.
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
    // A Home handoff shows the user's text but discovers with the
    // classifier's retrieval query, unless that is too short to search.
    const retrieval = handoff.smartQueryFor(searchTerm);
    const smartQuery = retrieval.trim().length >= 3 ? retrieval : searchTerm;
    // Smart search hides sort and filters, so the catalogue it lists must
    // not be sorted or filtered by them either.
    const listSort = isSmartSearchEnabled ? DEFAULT_SORT : sortBy;
    const payload = cataloguePayload(
      searchTerm,
      listSort,
      isSmartSearchEnabled ? null : filters,
      builtInCollectionId,
    );
    const path =
      scopeKind === "custom" && scopeId
        ? "custom"
        : isSmartSearchEnabled && smartQuery.trim().length >= 3
          ? "smart"
          : "catalogue";

    const key = JSON.stringify([
      hasToken,
      path,
      scopeKey,
      searchRun,
      path === "smart" ? smartQuery : payload,
    ]);
    if (key === lastStarted.current) return;
    lastStarted.current = key;

    const api = { queryDatasets, queryUserCollections, searchCrossDataset };
    const request = ++listRequest.current;
    const isLatest = () => request === listRequest.current;
    setIsLoading(true);
    setError(null);
    resetPaging();

    const run = async () => {
      try {
        if (!hasToken) {
          throw new ListFailure(ApiErrorMessage.NO_AUTH_TOKEN_FOUND);
        }
        const result =
          path === "smart"
            ? await loadSmart(api, smartQuery, builtInCollectionId)
            : path === "custom" && scopeId
              ? await loadCustom(api, scopeId)
              : await loadCatalogue(api, payload, listSort);
        if (!isLatest()) return;
        setDatasets(result.datasets);
        if (result.page) {
          const { itemCount, count } = result.page;
          startPaging(payload, listSort, itemCount, count);
        }
      } catch (err: unknown) {
        if (!isLatest()) return;
        lastStarted.current = null;
        // The Gateway's own error text stays in the log, not on the page.
        const failure =
          err instanceof ListFailure
            ? err
            : new ListFailure(
                ApiErrorMessage.FETCH_DATASETS_FAILED,
                "Failed to list datasets",
                err,
              );
        if (failure.logAs) logError(failure.logAs, failure.reason);
        setError(failure.shown);
        // Nothing stays listed (or selectable) behind the message.
        setDatasets([]);
      } finally {
        if (isLatest()) setIsLoading(false);
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
      setSearchTerm(pendingSearchTerm.trim());
      setIsSmartSearchEnabled(enabled);
    },
    [pendingSearchTerm],
  );

  return {
    datasets,
    isLoading,
    error,
    /** The text in the search box (submitted or not). */
    searchTerm: pendingSearchTerm,
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
