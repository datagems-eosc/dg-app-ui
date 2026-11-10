"use client";

export function ChatMessagesSkeleton() {
  return (
    <div className="p-6 3xl:px-0 3xl:py-6 space-y-7.5 max-w-4xl mx-auto">
      {/* AI Message Skeleton */}
      <div className="space-y-4 shadow-s1 border border-slate-350 rounded-2xl p-4 sm:px-6 sm:py-5">
        {/* AI Message Header Skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* AI Message Content Skeleton */}
        <div className="space-y-3">
          <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-3/4 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* User Message Skeleton */}
      <div className="flex justify-end">
        <div className="bg-slate-100 rounded-4xl px-6 py-3 max-w-xl">
          <div className="space-y-2">
            <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
            <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Another AI Message Skeleton */}
      <div className="space-y-4 shadow-s1 border border-slate-350 rounded-2xl p-4 sm:px-6 sm:py-5">
        {/* AI Message Header Skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* AI Message Content Skeleton */}
        <div className="space-y-3">
          <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-2/3 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-1/3 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Another User Message Skeleton */}
      <div className="flex justify-end">
        <div className="bg-slate-100 rounded-4xl px-6 py-3 max-w-xl">
          <div className="w-40 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
