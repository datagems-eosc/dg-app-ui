"use client";

export function RecommendationsSkeleton() {
  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="w-64 h-5 bg-slate-200 rounded animate-pulse mb-3" />
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-48 bg-slate-200 rounded-sm animate-pulse" />
        <div className="h-8 w-40 bg-slate-200 rounded-sm animate-pulse" />
        <div className="h-8 w-52 bg-slate-200 rounded-sm animate-pulse" />
        <div className="h-8 w-44 bg-slate-200 rounded-sm animate-pulse" />
      </div>
    </div>
  );
}
