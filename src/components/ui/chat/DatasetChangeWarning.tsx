import { Info } from "lucide-react";
import React from "react";

interface DatasetChangeWarningProps {
  isVisible: boolean;
}

export default function DatasetChangeWarning({
  isVisible,
}: DatasetChangeWarningProps) {
  if (!isVisible) return null;

  return (
    <div className="mb-13 p-3.5 bg-blue-75 rounded-full flex items-center justify-center gap-2">
      <Info className="w-4 h-4 text-blue-850" />
      <p className="text-body-14-regular text-blue-650">
        The selected datasets have changed. The AI will respond based on the
        updated list.
      </p>
    </div>
  );
}
