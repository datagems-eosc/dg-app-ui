"use client";

import { AIMessageContent } from "@/components/ui/chat/AIMessageContent";
import { AIMessageHeader } from "@/components/ui/chat/AIMessageHeader";
import { TemperatureMap } from "@/components/ui/chat/TemperatureMap";
import type { Message } from "@/types/chat";

interface AIMessageProps {
  message: Message;
  onSourcesClick?: () => void;
}

export function AIMessage({ message, onSourcesClick }: AIMessageProps) {
  return (
    <div className="w-full max-w-full space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6">
      <AIMessageHeader
        sources={message.sources}
        onSourcesClick={onSourcesClick}
      />

      <TemperatureMap
        content={message.content}
        latitude={message.latitude}
        longitude={message.longitude}
        tableData={message.tableData}
        baseRadius={90}
        heatOpacity={0.55}
        requireTableData={false}
      />

      <AIMessageContent
        content={message.content}
        tableData={message.tableData}
      />
    </div>
  );
}
