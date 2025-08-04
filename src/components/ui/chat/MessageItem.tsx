"use client";

import React from "react";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { Message } from "@/types/chat";

interface MessageItemProps {
  message: Message;
  onSourcesClick?: (messageId: string) => void;
}

export default function MessageItem({ message, onSourcesClick }: MessageItemProps) {
  return (
    <div className="space-y-4">
      {message.type === "user" ? (
        <UserMessage content={message.content} />
      ) : (
        <AIMessage message={message} onSourcesClick={() => onSourcesClick?.(message.id)} />
      )}
    </div>
  );
}
