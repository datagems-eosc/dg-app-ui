"use client";

import type React from "react";
import { useEffect } from "react";
import { scrollToBottom } from "@/lib/scrollUtils";
import type { Message } from "@/types/chat";
import { WorkingStatus } from "../WorkingStatus";
import {
  CHAT_WORKING_MESSAGES,
  CHAT_WORKING_REPEAT,
  type ChatWorkingStep,
} from "./chatWorkingStatus";
import MessageItem from "./MessageItem";

interface ChatMessagesProps {
  messages: Message[];
  isMessagesLoading: boolean;
  /** The step of the pending answer, which picks the status texts; undefined when no answer is pending. */
  pendingStep?: ChatWorkingStep;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSourcesClick?: (messageId: string) => void;
  onRecommendationClick?: (recommendation: string) => void;
  onDatasetProposalConfirm?: (messageId: string) => void;
  showSelectedPanel?: boolean;
}

export default function ChatMessages({
  messages,
  isMessagesLoading,
  pendingStep,
  messagesEndRef,
  onSourcesClick,
  onRecommendationClick,
  onDatasetProposalConfirm,
  showSelectedPanel,
}: ChatMessagesProps) {
  const isPending = pendingStep !== undefined;

  // Auto-scroll to bottom when generating AI response
  useEffect(() => {
    if (isPending && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [isPending, messagesEndRef]);

  // Also scroll when new messages are added
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [messages, messagesEndRef]);
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
          onDatasetProposalConfirm={onDatasetProposalConfirm}
          isLastAIMessage={
            message.type === "ai" && message.id === lastAIMessageId
          }
        />
      ))}

      {isPending && (
        <div className="max-w-4xl mx-auto px-4 lg:px-0 py-4">
          <WorkingStatus
            key={pendingStep}
            messages={CHAT_WORKING_MESSAGES[pendingStep]}
            repeat={CHAT_WORKING_REPEAT[pendingStep]}
            elapsed
          />
        </div>
      )}

      {/* Dummy div for scroll-to-bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
