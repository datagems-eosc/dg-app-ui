import { Info } from "lucide-react";

interface DatasetChangeWarningProps {
  isVisible: boolean;
}

export default function DatasetChangeWarning({
  isVisible,
}: DatasetChangeWarningProps) {
  if (!isVisible) return null;

  return (
    <div className="mb-4 sm:mb-13 p-3.5 bg-blue-75 rounded-full flex items-center gap-2">
      <Info className="w-4 h-4 text-blue-850 flex-shrink-0" />
      <p className="text-body-14-regular text-blue-650 flex-1">
        The selected datasets have changed. The AI will respond based on the
        updated list.
      </p>
    </div>
  );
}
