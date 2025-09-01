"use client";

import React, { useEffect, useState } from "react";
import { Search, MessageCircleMore } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { Input } from "../Input";
import { NoData } from "../NoData";
import { ChatItem } from "./ChatItem";

interface ConversationListItem {
  id: string;
  name?: string;
  createdAt?: string;
}



function ChatHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4">
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
  onDeleteConversation?: (conversationId: string, conversationName: string) => void;
}

export function ChatHistoryList({
  session,
  currentConversationId,
  onDeleteConversation,
}: ChatHistoryListProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleConversationUpdate = (id: string, newName: string) => {
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === id ? { ...conv, name: newName } : conv
      )
    );
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
              "etag",
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
                  etag?: string;
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
                    eTag: item.etag,
                    createdAt,
                  };
                }
              )
          : [];
        setConversations(conversations);
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
    search.trim().length === 0
      ? conversations
      : conversations.filter((c) =>
          (c.name || "Untitled Conversation")
            .toLowerCase()
            .includes(search.toLowerCase())
        );
  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search chat history..."
        rightIcon={<Search className="w-4 h-4 text-icon" />}
      />
      {filtered.length === 0 ? (
        <NoData
          icon={MessageCircleMore}
          title="Your Chat history will appear here"
          description="Ask a question first"
        />
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 hide-scrollbar" style={{ maxHeight: 'calc(100vh - 400px)' }}>
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
