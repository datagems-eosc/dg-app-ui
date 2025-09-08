"use client";

import React from "react";
import { Database, Download } from "lucide-react";
import { Button } from "../Button";
import { Bot } from "lucide-react";

interface AIMessageHeaderProps {
  sources?: number;
  onSourcesClick?: () => void;
}

export function AIMessageHeader({
  sources,
  onSourcesClick,
}: AIMessageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-75 rounded-full flex items-center justify-center">
          <Bot className="w-8 h-8 text-blue-850" />
        </div>
        <span className="text-H6-18-medium text-slate-850">DataGems AI</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
        {!!sources && (
          <Button variant="outline" size="sm" onClick={onSourcesClick}>
            <Database className="w-4 h-4 mr-1 text-icon" />
            {sources} {sources > 1 ? "Sources" : "Source"}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled>
          <Download className="w-4 h-4 mr-1 text-icon" />
          Download
        </Button>
      </div>
    </div>
  );
}
