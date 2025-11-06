"use client";

export function AIResponseSkeleton() {
  return (
    <div className="space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-6 pt-4 pb-6">
      {/* AI Message Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
          <div className="space-y-1">
            <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
            <div className="w-16 h-3 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
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
