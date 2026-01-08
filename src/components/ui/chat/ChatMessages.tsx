"use client";

import type React from "react";
import { useEffect } from "react";
import { scrollToBottom } from "@/lib/scrollUtils";
import type { Message } from "@/types/chat";
import MessageItem from "./MessageItem";

function SendingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Generating response...</p>
      </div>
    </div>
  );
}

interface ChatMessagesProps {
  messages: Message[];
  isMessagesLoading: boolean;
  isGeneratingAIResponse?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSourcesClick?: (messageId: string) => void;
  onRecommendationClick?: (recommendation: string) => void;
  showSelectedPanel?: boolean;
}

export default function ChatMessages({
  messages,
  isMessagesLoading,
  isGeneratingAIResponse = false,
  messagesEndRef,
  onSourcesClick,
  onRecommendationClick,
  showSelectedPanel,
}: ChatMessagesProps) {
  // Auto-scroll to bottom when generating AI response
  useEffect(() => {
    if (isGeneratingAIResponse && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [isGeneratingAIResponse, messagesEndRef]);

  // Also scroll when new messages are added
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [messages.length, messagesEndRef]);
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

  const lastAIMessageId = [...sortedMessages]
    .reverse()
    .find((msg) => msg.type === "ai")?.id;

  return (
    <div
      className={`px-4 py-4 lg:p-6 3xl:px-0 3xl:py-6 ${
        !showSelectedPanel && "px-0 lg:px-0 py-0 lg:py-0"
      } space-y-7.5 max-w-4xl mx-auto`}
    >
      {sortedMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onSourcesClick={onSourcesClick}
          onRecommendationClick={onRecommendationClick}
          isLastAIMessage={
            message.type === "ai" && message.id === lastAIMessageId
          }
        />
      ))}

      {/* AI Response Loading Spinner */}
      {isGeneratingAIResponse && <SendingSpinner />}

      {/* Dummy div for scroll-to-bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
