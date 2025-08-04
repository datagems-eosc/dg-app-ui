"use client";

import React from "react";
import { AIMessageHeader } from "@/components/ui/chat/AIMessageHeader";
import { TemperatureMap } from "@/components/ui/chat/TemperatureMap";
import { AIMessageContent } from "@/components/ui/chat/AIMessageContent";
import { Message } from "@/types/chat";

interface AIMessageProps {
  message: Message;
  onSourcesClick?: () => void;
}

export function AIMessage({ message, onSourcesClick }: AIMessageProps) {
  return (
    <div className="space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-6 pt-4 pb-6">
      <AIMessageHeader sources={message.sources} onSourcesClick={onSourcesClick} />

      <TemperatureMap 
        content={message.content} 
        latitude={message.latitude}
        longitude={message.longitude}
      />

      <AIMessageContent
        content={message.content}
        tableData={message.tableData}
      />
    </div>
  );
}
