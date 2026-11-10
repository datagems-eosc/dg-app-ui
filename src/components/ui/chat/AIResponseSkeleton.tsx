"use client";

export function AIResponseSkeleton() {
  return (
    <div className="space-y-4 shadow-s1 border border-slate-350 rounded-2xl p-4 sm:px-6 sm:py-5">
      {/* AI Message Header Skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse" />
        <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* AI Message Content Skeleton - Multiple lines with different widths */}
      <div className="space-y-3">
        <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
        <div className="w-5/6 h-4 bg-slate-200 rounded animate-pulse" />
        <div className="w-3/4 h-4 bg-slate-200 rounded animate-pulse" />
        <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse" />
        <div className="w-2/3 h-4 bg-slate-200 rounded animate-pulse" />
        <div className="w-1/3 h-4 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
