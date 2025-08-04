"use client";

import React from "react";
import { DataTable } from "@/components/ui/chat/DataTable";
import { TableData } from "@/types/chat";

interface AIMessageContentProps {
  content: string;
  tableData?: TableData;
}

export function AIMessageContent({
  content,
  tableData,
}: AIMessageContentProps) {
  return (
    <div>
      <div className="whitespace-pre-line text-body-16-regular text-gray-750">
        {content}
      </div>

      {tableData && <DataTable tableData={tableData} />}
    </div>
  );
}
