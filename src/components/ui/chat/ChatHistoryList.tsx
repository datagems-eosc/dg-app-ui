"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MessageCircleMore } from "lucide-react";
import { fetchWithAuth, formatRelativeTime } from "@/lib/utils";
import { Input } from "../Input";
import { NoData } from "../NoData";

interface ConversationListItem {
  id: string;
  name?: string;
  createdAt?: string;
}

interface ChatItemProps {
  conversation: ConversationListItem;
  isActive?: boolean;
}

function ChatItem({ conversation, isActive = false }: ChatItemProps) {
  const content = (
    <>
      <div className="flex flex-start items-center gap-2 flex-1 w-full">
        <MessageCircleMore className="w-4 h-4 flex-shrink-0 text-blue-850 group-hover:text-blue-600" />
        <span className="text-body-14-medium truncate max-w-[230px] text-gray-750">
          {conversation.name || "Untitled Conversation"}
        </span>
      </div>
      <span className="text-descriptions-12-regular tracking-1p text-gray-650">
        {conversation.createdAt
          ? formatRelativeTime(conversation.createdAt)
          : ""}
      </span>
    </>
  );

  if (isActive) {
    return (
      <div className="flex flex-col gap-1 p-3 rounded-lg border border-blue-300 cursor-default">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="flex flex-col gap-1 p-3 rounded-lg bg-blue-75 hover:bg-blue-100 transition-colors group"
    >
      {content}
    </Link>
  );
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
}

export function ChatHistoryList({
  session,
  currentConversationId,
}: ChatHistoryListProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = session?.accessToken;
        if (!token) return;
        const payload = {
          project: {
            fields: [
              "id",
              "name",
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
        const response = await fetchWithAuth("/api/conversation/me/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to fetch conversations");
        const data = await response.json();
        const conversations = Array.isArray(data.items)
          ? data.items.map(
              (item: {
                id: string;
                name?: string;
                messages?: { createdAt?: string }[];
              }) => {
                let createdAt = "";
                if (Array.isArray(item.messages) && item.messages.length > 0) {
                  createdAt = item.messages[0]?.createdAt || "";
                }
                return {
                  id: item.id,
                  name: item.name,
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
  }, []);

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
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[40vh] pr-1 hide-scrollbar">
          {filtered.map((conv) => (
            <ChatItem
              key={conv.id}
              conversation={conv}
              isActive={currentConversationId === conv.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
