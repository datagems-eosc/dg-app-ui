"use client";

import React from "react";
import { Message } from "@/types/chat";
import { ChatMessagesSkeleton } from "./ChatMessagesSkeleton";
import { AIResponseSkeleton } from "./AIResponseSkeleton";
import MessageItem from "./MessageItem";

interface ChatMessagesProps {
  messages: Message[];
  isMessagesLoading: boolean;
  isGeneratingAIResponse?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSourcesClick?: (messageId: string) => void;
  showSelectedPanel?: boolean;
}

export default function ChatMessages({
  messages,
  isMessagesLoading,
  isGeneratingAIResponse = false,
  messagesEndRef,
  onSourcesClick,
  showSelectedPanel,
}: ChatMessagesProps) {
  if (isMessagesLoading) {
    return <ChatMessagesSkeleton />;
  }

  // Sort messages by timestamp using ISO 8601 string comparison for microsecond precision
  const sortedMessages = [...messages].sort((a, b) => {
    // Convert both timestamps to ISO strings for lexicographic comparison
    const aISO =
      a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp;
    const bISO =
      b.timestamp instanceof Date ? b.timestamp.toISOString() : b.timestamp;

    // ISO 8601 strings are lexicographically sortable, providing microsecond/nanosecond precision
    return aISO.localeCompare(bISO);
  });

  return (
    <div
      className={`p-6 3xl:px-0 3xl:py-6 ${
        !showSelectedPanel && "px-0 py-0"
      } space-y-7.5 max-w-4xl mx-auto`}
    >
      {sortedMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onSourcesClick={onSourcesClick}
        />
      ))}

      {/* AI Response Skeleton */}
      {isGeneratingAIResponse && <AIResponseSkeleton />}

      {/* Dummy div for scroll-to-bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
