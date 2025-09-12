"use client";

import React, { useEffect, useState } from "react";
import { SearchX, MessageCircleMore } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { Search as SearchInput } from "../Search";
import { NoData } from "../NoData";
import { ChatItem } from "./ChatItem";

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
    conversationName: string
  ) => void;
  onConversationUpdate?: (
    id: string,
    newName: string,
    newETag?: string
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
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Use external conversations if provided, otherwise use local state
  const currentConversations = externalConversations || conversations;
  const setCurrentConversations = setExternalConversations || setConversations;

  const handleConversationUpdate = (
    id: string,
    newName: string,
    newETag?: string
  ) => {
    setCurrentConversations((prevConversations: any[]) =>
      prevConversations.map((conv: any) =>
        conv.id === id
          ? { ...conv, name: newName, eTag: newETag || conv.eTag }
          : conv
      )
    );
    // Also call the external handler if provided
    onConversationUpdate?.(id, newName, newETag);
  };

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = (session as any)?.accessToken;
        if (!token) return;
        const payload = {
          project: {
            fields: [
              "id",
              "name",
              "eTag",
              "user.id",
              "user.name",
              "datasets.dataset.id",
              "datasets.dataset.code",
              "messages.kind",
              "messages.data",
              "messages.createdAt",
            ],
          },
          page: { Offset: 0, Size: 100 },
          Order: { Items: ["-createdAt"] },
          Metadata: { CountAll: true },
        };
        const data = await apiClient.queryConversations(payload, token);
        const conversations = Array.isArray(data.items)
          ? data.items
              .filter(
                (item: {
                  id: string;
                  name?: string;
                  messages?: { createdAt?: string }[];
                }) => {
                  // Only include conversations that have messages array with at least one message
                  return (
                    item.messages &&
                    Array.isArray(item.messages) &&
                    item.messages.length > 0
                  );
                }
              )
              .map(
                (item: {
                  id: string;
                  name?: string;
                  eTag?: string;
                  messages?: { createdAt?: string }[];
                }) => {
                  let createdAt = "";
                  if (
                    Array.isArray(item.messages) &&
                    item.messages.length > 0
                  ) {
                    createdAt = item.messages[0]?.createdAt || "";
                  }
                  return {
                    id: item.id,
                    name: item.name,
                    eTag: item.eTag,
                    createdAt,
                  };
                }
              )
          : [];
        setCurrentConversations(conversations);
      } catch {
        setError("Failed to load chat history");
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, [session]);

  if (isLoading) {
    return <ChatHistorySkeleton />;
  }
  if (error) {
    return <div className="text-red-600 text-center py-4">{error}</div>;
  }
  const filtered =
    searchQuery.trim().length === 0
      ? currentConversations
      : currentConversations.filter((c) =>
          (c.name || "Untitled Conversation")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
  return (
    <div className="flex flex-col gap-4">
      <div className="pt-0.75 px-5">
        <SearchInput
          placeholder="Search chat history..."
          value={searchInput}
          onChange={(v) => setSearchInput(v)}
          onSearch={(v) => setSearchQuery(v ?? searchInput)}
          onClear={() => {
            setSearchInput("");
            setSearchQuery("");
          }}
          className="text-base sm:text-sm"
          disabled={false}
          size="medium"
        />
      </div>
      {currentConversations.length === 0 ? (
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
        <div
          className="flex flex-col gap-1 overflow-y-auto pl-5 pr-6 hide-scrollbar"
          style={{ maxHeight: "calc(100vh - 400px)" }}
        >
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
    </div>
  );
}
