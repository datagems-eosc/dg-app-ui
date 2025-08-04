"use client";

import React from "react";
import { Message } from "@/types/chat";
import { LoadingSpinner } from "./LoadingSpinner";
import MessageItem from "./MessageItem";

interface ChatMessagesProps {
  messages: Message[];
  isMessagesLoading: boolean;
  isGeneratingAIResponse?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSourcesClick?: (messageId: string) => void;
}

export default function ChatMessages({
  messages,
  isMessagesLoading,
  isGeneratingAIResponse = false,
  messagesEndRef,
  onSourcesClick,
}: ChatMessagesProps) {
  if (isMessagesLoading) {
    return <LoadingSpinner />;
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
    <div className="p-6 space-y-7.5">
      {sortedMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onSourcesClick={onSourcesClick}
        />
      ))}
      {/* Dummy div for scroll-to-bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
