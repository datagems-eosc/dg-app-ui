interface DatasetCardSkeletonProps {
  viewMode?: "grid" | "list";
}

export default function DatasetCardSkeleton({
  viewMode = "grid",
}: DatasetCardSkeletonProps) {
  const isListMode = viewMode === "list";

  return (
    <div className="rounded-2xl border-1 border-slate-200 bg-white p-5 animate-pulse">
      {/* Header with title and star */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-6 bg-slate-200 rounded mb-3 w-3/4"></div>
          <div className="flex items-center gap-1">
            <div className="h-6 bg-slate-200 rounded w-20"></div>
            <div className="h-6 bg-slate-200 rounded w-24"></div>
          </div>
        </div>
        <div className="h-6 w-6 bg-slate-200 rounded flex-shrink-0"></div>
      </div>

      {/* Description */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-slate-200 rounded w-full"></div>
        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
      </div>

      {/* Footer with action buttons and metadata */}
      <div className="flex items-center justify-between gap-2">
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <div className="h-8 bg-slate-200 rounded w-16"></div>
          <div className="h-8 bg-slate-200 rounded w-20"></div>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-descriptions-12-regular text-gray-500">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-slate-200 rounded"></div>
              <div className="h-3 bg-slate-200 rounded w-12"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-slate-200 rounded"></div>
              <div className="h-3 bg-slate-200 rounded w-16"></div>
            </div>
            {isListMode && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-slate-200 rounded"></div>
                <div className="h-3 bg-slate-200 rounded w-20"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
