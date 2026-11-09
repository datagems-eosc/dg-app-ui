import { type MutableRefObject, useCallback, useRef, useState } from "react";
import { ApiErrorMessage } from "@/lib/apiErrors";

export const CATALOGUE_PAGE_SIZE = 25;

type CataloguePage = { items?: unknown; count?: unknown };

interface CataloguePagingOptions {
  /** Shared with the search request: only the latest request updates the list. */
  listRequest: MutableRefObject<number>;
  query: (payload: Record<string, unknown>) => Promise<CataloguePage>;
  /** Adds one page of Gateway items to the list, ordered by `sort`. */
  appendPage: (items: unknown[], sort: string) => void;
}

/**
 * "Load more" over the catalogue: remembers the request behind the current
 * list and how much of it is loaded, and asks for the next page with the same
 * search, filters and sort.
 */
export function useCataloguePaging({
  listRequest,
  query,
  appendPage,
}: CataloguePagingOptions) {
  const base = useRef<{
    payload: Record<string, unknown>;
    sort: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const reset = useCallback(() => {
    base.current = null;
    setLoaded(0);
    setTotal(0);
    setIsLoadingMore(false);
    setLoadMoreError(null);
  }, []);

  /** Records the first page of a new list. */
  const start = useCallback(
    (
      payload: Record<string, unknown>,
      sort: string,
      itemCount: number,
      count: unknown,
    ) => {
      base.current = { payload, sort };
      setLoaded(itemCount);
      setTotal(typeof count === "number" ? count : itemCount);
    },
    [],
  );

  const loadMore = useCallback(async () => {
    const current = base.current;
    if (!current) return;
    const request = ++listRequest.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await query({
        ...current.payload,
        page: { Offset: loaded, Size: CATALOGUE_PAGE_SIZE },
      });
      if (request !== listRequest.current) return;
      const items = Array.isArray(data.items) ? data.items : [];
      appendPage(items, current.sort);
      const next = loaded + items.length;
      setLoaded(next);
      // An empty page means the total was stale: stop offering more.
      setTotal(
        items.length > 0 && typeof data.count === "number" ? data.count : next,
      );
    } catch {
      if (request !== listRequest.current) return;
      // The list already shown stays; the message sits beside the button.
      setLoadMoreError(ApiErrorMessage.LOAD_MORE_DATASETS_FAILED);
    } finally {
      if (request === listRequest.current) setIsLoadingMore(false);
    }
  }, [appendPage, listRequest, loaded, query]);

  return {
    reset,
    start,
    loadMore,
    total,
    hasMore: total > loaded,
    isLoadingMore,
    loadMoreError,
  };
}
