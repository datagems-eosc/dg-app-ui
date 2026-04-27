"use client";

import React, { useEffect, useRef, useState } from "react";
import RcaiFlashingCursor from "@/components/RcaiChat/RcaiFlashingCursor";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";

export default function RcaiStreamedMarkdown({
  messageId,
  content,
  isStreaming,
  onTick,
  onDone,
  statusText,
  isComplete,
}: {
  messageId: string;
  content: string;
  isStreaming: boolean;
  onTick?: () => void;
  onDone?: () => void;
  statusText?: string | null;
  isComplete?: boolean;
}) {
  const fullContentRef = useRef(content);
  useEffect(() => {
    fullContentRef.current = content;
  }, [content]);

  const onTickRef = useRef<typeof onTick>(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const onDoneRef = useRef<typeof onDone>(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const isCompleteRef = useRef(Boolean(isComplete));
  useEffect(() => {
    isCompleteRef.current = Boolean(isComplete);
  }, [isComplete]);

  const hasFiredDoneRef = useRef(false);
  useEffect(() => {
    hasFiredDoneRef.current = false;
  }, [messageId]);

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
      let didReachEnd = false;
      setDisplayedContent((prev) => {
        const currentLength = prev.length;
        const fullLength = fullContentRef.current.length;

        if (currentLength >= fullLength) {
          didReachEnd = true;
          return prev;
        }

        const pending = fullLength - currentLength;
        const step =
          pending > 15
            ? Math.min(pending, 6)
            : Math.max(1, Math.min(2, pending));
        const nextLength = Math.min(currentLength + step, fullLength);
        const nextValue = fullContentRef.current.slice(0, nextLength);
        if (nextLength >= fullLength) {
          didReachEnd = true;
        }
        return nextValue;
      });
      onTickRef.current?.();

      if (didReachEnd && isCompleteRef.current && !hasFiredDoneRef.current) {
        hasFiredDoneRef.current = true;
        onDoneRef.current?.();
      }
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [isStreaming, messageId]);

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
