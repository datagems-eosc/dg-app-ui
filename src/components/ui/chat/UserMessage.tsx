"use client";

import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="bg-slate-100 text-slate-850 rounded-4xl px-4 py-2.5 sm:px-6 sm:py-3 max-w-[85%] sm:max-w-xl text-body-16-regular break-words overflow-hidden">
        <RcaiMarkdown content={content} />
      </div>
    </div>
  );
}
