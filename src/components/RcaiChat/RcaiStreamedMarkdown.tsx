"use client";

import React, { useEffect, useRef, useState } from "react";
import RcaiFlashingCursor from "@/components/RcaiChat/RcaiFlashingCursor";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";

export default function RcaiStreamedMarkdown({
  messageId,
  content,
  isStreaming,
  onTick,
  statusText,
}: {
  messageId: string;
  content: string;
  isStreaming: boolean;
  onTick?: () => void;
  statusText?: string | null;
}) {
  const fullContentRef = useRef(content);
  useEffect(() => {
    fullContentRef.current = content;
  }, [content]);

  const [displayedContent, setDisplayedContent] = useState("");

  useEffect(() => {
    if (isStreaming) {
      setDisplayedContent("");
      return;
    }

    setDisplayedContent(content);
  }, [isStreaming, messageId]);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
    }
  }, [content, isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const interval = setInterval(() => {
      setDisplayedContent((prev) => {
        const currentLength = prev.length;
        const fullLength = fullContentRef.current.length;

        if (currentLength >= fullLength) {
          return prev;
        }

        const pending = fullLength - currentLength;
        const step =
          pending > 15
            ? Math.min(pending, 6)
            : Math.max(1, Math.min(2, pending));
        const nextLength = Math.min(currentLength + step, fullLength);
        return fullContentRef.current.slice(0, nextLength);
      });
      onTick?.();
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [isStreaming, messageId, onTick]);

  return (
    <div className="w-full">
      <RcaiMarkdown content={isStreaming ? displayedContent : content} />
      {isStreaming ? (
        <div className="mt-1 text-xs text-slate-500 flex items-center">
          {statusText ? <span className="truncate">{statusText}</span> : null}
          <RcaiFlashingCursor />
        </div>
      ) : null}
    </div>
  );
}
