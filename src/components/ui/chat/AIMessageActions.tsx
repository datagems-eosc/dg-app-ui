"use client";

import { Database } from "lucide-react";
import { Button } from "../Button";

interface AIMessageActionsProps {
  sources?: number;
  onSourcesClick?: () => void;
}

// A quiet row under the reply: ghost buttons recoloured to the secondary text tone.
const quietAction =
  "h-8 px-2 rounded-lg shadow-none hover:shadow-none !text-gray-650 hover:!text-gray-650 active:!text-gray-650 hover:bg-slate-100 active:bg-slate-200 [&>svg]:stroke-gray-650 hover:[&>svg]:stroke-gray-650 active:[&>svg]:stroke-gray-650";

// Download is left out until the Gateway can export an answer.
export function AIMessageActions({
  sources,
  onSourcesClick,
}: AIMessageActionsProps) {
  if (!sources) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 -ml-2">
      <Button
        variant="ghost"
        size="sm"
        className={quietAction}
        onClick={onSourcesClick}
      >
        <Database className="w-4 h-4 mr-1.5" />
        {sources} {sources > 1 ? "Sources" : "Source"}
      </Button>
    </div>
  );
}
