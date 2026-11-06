"use client";

import { MessageCircleMore, SearchX } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button } from "../Button";
import { NoData } from "../NoData";
import { Search as SearchInput } from "../Search";
import { ChatItem } from "./ChatItem";

// Only what the list shows: name, date, eTag for rename, and message ids so
// conversations without messages can be hidden (no Gateway filter for that).
const LIST_FIELDS = ["id", "name", "eTag", "createdAt", "messages.id"];
const PAGE_SIZE = 10;

interface ApiConversation {
  id: string;
  name?: string;
  eTag?: string;
  createdAt?: string;
  messages?: unknown[];
}

// Gateway `like` is a Postgres ILIKE on the name: escape its wildcards so the
// user's text is matched literally, then match anywhere in the name.
const toNameLike = (text: string) =>
  `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const toListItems = (items: ApiConversation[]): ConversationListItem[] =>
  items
    .filter((item) => Array.isArray(item.messages) && item.messages.length > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      eTag: item.eTag ?? "",
      createdAt: item.createdAt || "",
    }));

interface ConversationListItem {
  id: string;
  name?: string;
  createdAt?: string;
  eTag: string;
}

function ChatHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5">
      {/* Search input skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>

      {/* Chat items skeleton */}
      <div className="flex flex-col gap-1">
        {[1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-1 p-3 rounded-lg bg-gray-100 animate-pulse"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-300 rounded flex-shrink-0"></div>
              <div className="h-4 bg-gray-300 rounded w-48"></div>
            </div>
            <div className="h-3 bg-gray-300 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChatHistoryListProps {
  session: any;
  currentConversationId?: string;
  onDeleteConversation?: (
    conversationId: string,
    conversationName: string,
  ) => void;
  onConversationUpdate?: (
    id: string,
    newName: string,
    newETag?: string,
  ) => void;
  conversations?: any[];
  setConversations?: React.Dispatch<React.SetStateAction<any[]>>;
}

export function ChatHistoryList({
  session,
  currentConversationId,
  onDeleteConversation,
  onConversationUpdate,
  conversations: externalConversations,
  setConversations: setExternalConversations,
}: ChatHistoryListProps) {
  const api = useApi();
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [serverLoaded, setServerLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [like, setLike] = useState<string | null>(null);
  const [listFailed, setListFailed] = useState(false);
  // Only the latest list request may update the list (search, clear, load more).
  const requestSeq = useRef(0);
  // Visible ids fetched for the current listing; ids missing from the list
  // were deleted, so the server has shifted and the next offset moves back.
  const fetchedIds = useRef<Set<string>>(new Set());

  // Use external conversations if provided, otherwise use local state
  const currentConversations = externalConversations || conversations;
  const setCurrentConversations = setExternalConversations || setConversations;

  const handleConversationUpdate = (
    id: string,
    newName: string,
    newETag?: string,
  ) => {
    setCurrentConversations((prevConversations: any[]) =>
      prevConversations.map((conv: any) =>
        conv.id === id
          ? { ...conv, name: newName, eTag: newETag || conv.eTag }
          : conv,
      ),
    );
    // Also call the external handler if provided
    onConversationUpdate?.(id, newName, newETag);
  };

  const queryPage = (offset: number, nameLike: string | null) =>
    api.queryConversations({
      project: { fields: LIST_FIELDS },
      page: { Offset: offset, Size: PAGE_SIZE },
      Order: { Items: ["-createdAt"] },
      Metadata: { CountAll: true },
      ...(nameLike ? { like: nameLike } : {}),
    });

  // Paging counts server items, including the empty conversations hidden here.
  const applyPage = (
    data: { items?: unknown; count?: number },
    offset: number,
  ) => {
    const items = Array.isArray(data.items)
      ? (data.items as ApiConversation[])
      : [];
    const loaded = offset + items.length;
    setServerLoaded(loaded);
    setTotal(items.length === 0 ? loaded : (data.count ?? loaded));
    const visible = toListItems(items);
    if (offset === 0) fetchedIds.current = new Set();
    for (const item of visible) fetchedIds.current.add(item.id);
    return visible;
  };

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      if (!api.hasToken) {
        setIsLoading(false);
        return;
      }
      const seq = ++requestSeq.current;
      try {
        const data = await queryPage(0, null);
        if (seq !== requestSeq.current) return;
        setCurrentConversations(applyPage(data, 0));
      } catch {
        if (seq === requestSeq.current) setError("Failed to load chat history");
      } finally {
        if (seq === requestSeq.current) setIsLoading(false);
      }
    };
    fetchConversations();
  }, [api.hasToken]);

  const showFirstPage = async (nameLike: string | null) => {
    const seq = ++requestSeq.current;
    setLike(nameLike);
    setServerLoaded(0);
    setTotal(0);
    setListFailed(false);
    setLoadMoreFailed(false);
    setIsLoadingMore(false);
    try {
      const data = await queryPage(0, nameLike);
      if (seq !== requestSeq.current) return;
      setCurrentConversations(applyPage(data, 0));
    } catch {
      if (seq !== requestSeq.current) return;
      setCurrentConversations([]);
      setServerLoaded(0);
      setTotal(0);
      setListFailed(true);
    }
  };

  const search = (text: string) => {
    const term = text.trim();
    setSearchQuery(term);
    void showFirstPage(term ? toNameLike(term) : null);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    void showFirstPage(null);
  };

  const loadMore = async () => {
    const seq = ++requestSeq.current;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const shown = new Set(currentConversations.map((c) => c.id));
      let deleted = 0;
      for (const id of fetchedIds.current) if (!shown.has(id)) deleted++;
      const offset = Math.max(0, serverLoaded - deleted);
      const data = await queryPage(offset, like);
      if (seq !== requestSeq.current) return;
      for (const id of fetchedIds.current)
        if (!shown.has(id)) fetchedIds.current.delete(id);
      const next = applyPage(data, offset).filter((c) => !shown.has(c.id));
      setCurrentConversations((prev: ConversationListItem[]) => [
        ...prev,
        ...next,
      ]);
    } catch {
      if (seq === requestSeq.current) setLoadMoreFailed(true);
    } finally {
      if (seq === requestSeq.current) setIsLoadingMore(false);
    }
  };

  const hasMore = serverLoaded < total;

  if (isLoading) {
    return <ChatHistorySkeleton />;
  }
  if (error) {
    return <div className="text-red-600 text-center py-4">{error}</div>;
  }
  const filtered = currentConversations;
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="pt-0.75 px-5 flex-shrink-0">
        <SearchInput
          placeholder="Search chat history..."
          value={searchInput}
          onChange={(v) => setSearchInput(v)}
          onSearch={(v) => search(v ?? searchInput)}
          onClear={clearSearch}
          className="text-base sm:text-sm"
          disabled={false}
          size="medium"
        />
      </div>
      {listFailed ? (
        <NoData
          icon={SearchX}
          title={searchQuery ? "Couldn't search chats" : "Couldn't load chats"}
          description="Please try again"
          className="px-5"
        />
      ) : currentConversations.length === 0 && searchQuery.length === 0 ? (
        <NoData
          icon={MessageCircleMore}
          title="Your Chat history will appear here"
          description="Ask a question first"
          className="px-5"
        />
      ) : searchQuery.trim().length > 0 && filtered.length === 0 ? (
        <NoData
          icon={SearchX}
          title="No results found"
          description="Please try different search"
          className="px-5"
        />
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto pl-5 pr-4 scrollbar-hover flex-1 min-h-0">
          {filtered.map((conv) => (
            <ChatItem
              key={conv.id}
              conversation={conv}
              isActive={currentConversationId === conv.id}
              onConversationUpdate={handleConversationUpdate}
              onDeleteConversation={onDeleteConversation}
            />
          ))}
        </div>
      )}
      {hasMore && !listFailed && (
        <div className="flex flex-col items-start gap-1 px-5 pb-3">
          {loadMoreFailed && (
            <p className="text-descriptions-12-regular text-red-600">
              Couldn&apos;t load more chats.
            </p>
          )}
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more chats"}
          </Button>
        </div>
      )}
    </div>
  );
}
