"use client";

import React from "react";

export function ChatMessagesSkeleton() {
  return (
    <div className="p-6 3xl:px-0 3xl:py-6 space-y-7.5 max-w-4xl mx-auto">
      {/* AI Message Skeleton */}
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

        {/* AI Message Content Skeleton */}
        <div className="space-y-3">
          <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-3/4 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* User Message Skeleton */}
      <div className="flex justify-end items-end gap-4">
        <div className="bg-slate-75 rounded-4xl px-6 py-3 max-w-xl">
          <div className="space-y-2">
            <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
            <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
      </div>

      {/* Another AI Message Skeleton */}
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

        {/* AI Message Content Skeleton */}
        <div className="space-y-3">
          <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-2/3 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-1/3 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Another User Message Skeleton */}
      <div className="flex justify-end items-end gap-4">
        <div className="bg-slate-75 rounded-4xl px-6 py-3 max-w-xl">
          <div className="w-40 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
      </div>
    </div>
  );
} 