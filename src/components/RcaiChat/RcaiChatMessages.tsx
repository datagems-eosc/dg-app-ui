"use client";

import { useSession } from "next-auth/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";
import RcaiStreamedMarkdown from "@/components/RcaiChat/RcaiStreamedMarkdown";
import { Avatar } from "@/components/ui/Avatar";
import { AIMessageContent } from "@/components/ui/chat/AIMessageContent";
import { AIMessageHeader } from "@/components/ui/chat/AIMessageHeader";
import { scrollToBottom } from "@/lib/scrollUtils";
import type { Message } from "@/types/chat";

function extractSqlQueryBlocks(content: string): {
  contentWithoutSqlQuery: string;
  sqlQueries: string[] | undefined;
} {
  const re = /```sqlquery\s*([\s\S]*?)```/gi;
  const sqlQueries: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const extracted = String(match[1] ?? "").trim();
    if (extracted.length > 0) sqlQueries.push(extracted);
  }

  let without = content.replace(re, "").trim();

  if (sqlQueries.length > 0 && without) {
    const stripLeak = (text: string, sql: string) => {
      const candidates = [
        sql.slice(0, Math.min(300, sql.length)),
        sql.slice(Math.max(0, sql.length - Math.min(300, sql.length))),
      ].filter((s) => s.length >= 80);

      let next = text;
      for (const cand of candidates) {
        const idx = next.indexOf(cand);
        if (idx >= 0) {
          next = (next.slice(0, idx) + next.slice(idx + cand.length)).trim();
        }
      }
      return next;
    };

    without = sqlQueries.reduce((acc, sql) => stripLeak(acc, sql), without);
  }
  return {
    contentWithoutSqlQuery: without,
    sqlQueries: sqlQueries.length > 0 ? sqlQueries : undefined,
  };
}

export default function RcaiChatMessages({
  messages,
  isMessagesLoading,
  isGeneratingAIResponse,
  messagesEndRef,
  streamingMessageId,
  streamingMessageCompleteId,
  onStreamingMessageDone,
  progressText,
  showTurtle,
  hasAssistantOutputStarted,
  thinkingSteps,
  thinkingExpanded,
  onToggleThinkingExpanded,
  onSaveAndRunSqlQuery,
}: {
  messages: Message[];
  isMessagesLoading: boolean;
  isGeneratingAIResponse: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamingMessageId: string | null;
  streamingMessageCompleteId?: string | null;
  onStreamingMessageDone?: (messageId: string) => void;
  progressText: string | null;
  showTurtle: boolean;
  hasAssistantOutputStarted: boolean;
  thinkingSteps?: string[];
  thinkingExpanded?: boolean;
  onToggleThinkingExpanded?: () => void;
  onSaveAndRunSqlQuery?: (sqlQuery: string) => void;
}) {
  const { data: session } = useSession();

  const handleStreamTick = useCallback(() => {
    if (messagesEndRef.current) {
      scrollToBottom(messagesEndRef.current, {
        behavior: "auto",
        retryDelays: [],
      });
    }
  }, [messagesEndRef]);

  useEffect(() => {
    if (isGeneratingAIResponse && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [isGeneratingAIResponse, messagesEndRef]);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(messagesEndRef.current);
        });
      });
    }
  }, [messages.length, messagesEndRef]);

  const sortedMessages = [...messages].sort((a, b) => {
    const aISO =
      a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp;
    const bISO =
      b.timestamp instanceof Date ? b.timestamp.toISOString() : b.timestamp;
    return aISO.localeCompare(bISO);
  });

  const lastUserMessageId = [...sortedMessages]
    .reverse()
    .find((msg) => msg.type === "user")?.id;

  const showThinkingBlock =
    Boolean(progressText) || Boolean(thinkingSteps && thinkingSteps.length > 0);

  const collapsedThinkingText = useMemo(() => {
    const toSingleLine = (value: string) => value.replace(/\s+/g, " ").trim();

    if (!thinkingSteps || thinkingSteps.length === 0) {
      return toSingleLine(progressText || "Thinking...");
    }

    const lastStepRaw = thinkingSteps[thinkingSteps.length - 1] ?? "";
    const lastStep = toSingleLine(lastStepRaw);
    return lastStep.length > 0
      ? `Step ${thinkingSteps.length}: ${lastStep}`
      : toSingleLine(progressText || "Thinking...");
  }, [progressText, thinkingSteps]);

  const [
    { prev: prevThinkingText, current: currentThinkingText },
    setThinkingTicker,
  ] = useState<{ prev: string | null; current: string }>(() => ({
    prev: null,
    current: collapsedThinkingText,
  }));
  const [isThinkingAnimating, setIsThinkingAnimating] = useState(false);
  const thinkingAnimTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showThinkingBlock || thinkingExpanded) return;
    if (collapsedThinkingText === currentThinkingText) return;

    setThinkingTicker({
      prev: currentThinkingText,
      current: collapsedThinkingText,
    });
    setIsThinkingAnimating(false);

    const rafId = window.requestAnimationFrame(() => {
      setIsThinkingAnimating(true);
    });

    if (thinkingAnimTimeoutRef.current) {
      window.clearTimeout(thinkingAnimTimeoutRef.current);
    }

    thinkingAnimTimeoutRef.current = window.setTimeout(() => {
      setThinkingTicker((s) => ({ prev: null, current: s.current }));
      setIsThinkingAnimating(false);
      thinkingAnimTimeoutRef.current = null;
    }, 220);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    collapsedThinkingText,
    currentThinkingText,
    showThinkingBlock,
    thinkingExpanded,
  ]);

  useEffect(() => {
    if (showThinkingBlock) return;
    if (thinkingAnimTimeoutRef.current) {
      window.clearTimeout(thinkingAnimTimeoutRef.current);
      thinkingAnimTimeoutRef.current = null;
    }
    setIsThinkingAnimating(false);
    setThinkingTicker({ prev: null, current: collapsedThinkingText });
  }, [collapsedThinkingText, showThinkingBlock]);

  return (
    <div className="px-4 py-4 lg:p-6 3xl:px-0 3xl:py-6 space-y-7.5 max-w-4xl mx-auto">
      {isMessagesLoading && sortedMessages.length === 0 ? (
        <div className="text-gray-600">Loading…</div>
      ) : null}

      {sortedMessages.map((message) => {
        if (message.type === "user") {
          return (
            <React.Fragment key={message.id}>
              <div className="flex justify-end items-end gap-3 sm:gap-4">
                <div className="bg-slate-75 text-slate-850 rounded-4xl px-4 py-2.5 sm:px-6 sm:py-3 max-w-[85%] sm:max-w-xl text-body-16-regular break-words overflow-hidden">
                  <RcaiMarkdown content={message.content} />
                </div>
                <Avatar
                  src={undefined}
                  name={session?.user?.name || ""}
                  email={session?.user?.email || ""}
                  size="md"
                  className="self-start"
                />
              </div>

              {message.id === lastUserMessageId && showThinkingBlock ? (
                <div className="max-w-4xl mx-auto px-4 lg:px-0">
                  <div className="border-l-2 border-slate-350 pl-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-850">
                        Thinking
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {thinkingExpanded ? (
                          <div className="break-words whitespace-pre-wrap">
                            {!thinkingSteps || thinkingSteps.length === 0
                              ? progressText || "Thinking..."
                              : thinkingSteps
                                  .map((s, i) => `Step ${i + 1}: ${s}`)
                                  .join("\n")}
                          </div>
                        ) : (
                          <div className="relative overflow-hidden h-5 whitespace-nowrap">
                            {prevThinkingText ? (
                              <div
                                className={`absolute inset-0 transition-all duration-200 ease-out truncate ${
                                  isThinkingAnimating
                                    ? "-translate-y-5 opacity-0"
                                    : "translate-y-0 opacity-100"
                                }`}
                              >
                                {prevThinkingText}
                              </div>
                            ) : null}

                            <div
                              className={`absolute inset-0 transition-all duration-200 ease-out truncate ${
                                prevThinkingText
                                  ? isThinkingAnimating
                                    ? "translate-y-0 opacity-100"
                                    : "translate-y-5 opacity-0"
                                  : "translate-y-0 opacity-100"
                              }`}
                            >
                              {currentThinkingText}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {thinkingSteps && thinkingSteps.length > 1 ? (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
                        onClick={onToggleThinkingExpanded}
                      >
                        {thinkingExpanded ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </React.Fragment>
          );
        }

        const { contentWithoutSqlQuery, sqlQueries } = extractSqlQueryBlocks(
          message.content,
        );

        return (
          <div
            key={message.id}
            className="w-full max-w-full space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6"
          >
            <AIMessageHeader />
            <div className="text-body-16-regular text-gray-750 break-words overflow-hidden">
              {streamingMessageId === message.id ? (
                <RcaiStreamedMarkdown
                  messageId={message.id}
                  content={contentWithoutSqlQuery}
                  isStreaming={true}
                  isComplete={streamingMessageCompleteId === message.id}
                  onDone={() => onStreamingMessageDone?.(message.id)}
                  statusText={
                    !hasAssistantOutputStarted
                      ? progressText
                        ? `${progressText}${showTurtle ? " \uD83D\uDC22" : ""}`
                        : showTurtle
                          ? "\uD83D\uDC22"
                          : null
                      : null
                  }
                  onTick={handleStreamTick}
                />
              ) : (
                <AIMessageContent
                  content={contentWithoutSqlQuery}
                  sqlQueries={sqlQueries}
                  isGenerating={isGeneratingAIResponse}
                  onSaveAndRunSqlQuery={onSaveAndRunSqlQuery}
                />
              )}
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
