"use client";

import { Button } from "@ui/Button";
import { Tooltip } from "@ui/Tooltip";
import { Download } from "lucide-react";

interface DownloadCsvButtonProps {
  onDownload: () => void;
}

export function DownloadCsvButton({ onDownload }: DownloadCsvButtonProps) {
  return (
    <Tooltip content="Download CSV" position="left" delay={200} showOnFocus>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Download CSV"
        onClick={onDownload}
        className="items-center justify-center"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
