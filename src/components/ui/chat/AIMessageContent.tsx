"use client";

import { DataTable } from "@/components/ui/chat/DataTable";
import type { TableData } from "@/types/chat";

interface AIMessageContentProps {
  content: string;
  tableData?: TableData;
}

export function AIMessageContent({
  content,
  tableData,
}: AIMessageContentProps) {
  return (
    <div className="w-full max-w-full">
      <div className="whitespace-pre-line text-body-16-regular text-gray-750 break-words overflow-hidden">
        {content}
      </div>

      {tableData && (
        <div className="mt-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <DataTable tableData={tableData} />
        </div>
      )}
    </div>
  );
}
