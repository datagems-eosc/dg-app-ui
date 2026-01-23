"use client";

import type { Message } from "@/types/chat";
import { AIMessage } from "./AIMessage";
import { UserMessage } from "./UserMessage";

interface MessageItemProps {
  message: Message;
  onSourcesClick?: (messageId: string) => void;
  onRecommendationClick?: (recommendation: string) => void;
  isLastAIMessage?: boolean;
}

export default function MessageItem({
  message,
  onSourcesClick,
  onRecommendationClick,
  isLastAIMessage = false,
}: MessageItemProps) {
  return (
    <div className="space-y-4">
      {message.type === "user" ? (
        <UserMessage content={message.content} />
      ) : (
        <AIMessage
          message={message}
          onSourcesClick={() => onSourcesClick?.(message.id)}
          onRecommendationClick={onRecommendationClick}
          isLastAIMessage={isLastAIMessage}
        />
      )}
    </div>
  );
}
