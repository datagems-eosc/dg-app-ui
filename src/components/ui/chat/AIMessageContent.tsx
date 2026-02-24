"use client";

import { DataTable } from "@ui/chat/DataTable";
import { ChevronUp, ThumbsDown, ThumbsUp } from "lucide-react";
import React, { useState } from "react";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";
import type { TableData } from "@/types/chat";

interface AIMessageContentProps {
  content: string;
  tableData?: TableData;
  sqlQuery?: string;
}

export function AIMessageContent({
  content,
  tableData,
  sqlQuery,
}: AIMessageContentProps) {
  const [isSqlExpanded, setIsSqlExpanded] = useState(false);

  return (
    <div className="w-full max-w-full">
      <div className="text-body-16-regular text-gray-750 break-words overflow-hidden">
        <RcaiMarkdown content={content} />
      </div>

      {tableData && (
        <div className="mt-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <DataTable tableData={tableData} />
        </div>
      )}

      {sqlQuery ? (
        <div className="mt-4 border border-slate-350 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
            <div className="text-body-14-semibold text-slate-850">
              SQL Query
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled
                className="text-slate-500 disabled:opacity-50"
                aria-label="Like"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled
                className="text-slate-500 disabled:opacity-50"
                aria-label="Dislike"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsSqlExpanded((v) => !v)}
                className="text-slate-700"
                aria-expanded={isSqlExpanded}
                aria-label={
                  isSqlExpanded ? "Collapse SQL Query" : "Expand SQL Query"
                }
              >
                <ChevronUp
                  className={isSqlExpanded ? "w-4 h-4" : "w-4 h-4 rotate-180"}
                />
              </button>
            </div>
          </div>

          {isSqlExpanded ? (
            <div className="border-t border-slate-350 bg-slate-25 px-4 py-4">
              <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap break-words">
                {sqlQuery}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
