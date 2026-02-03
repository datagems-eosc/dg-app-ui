"use client";

import { useSession } from "next-auth/react";
import type React from "react";
import { useEffect } from "react";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";
import RcaiStreamedMarkdown from "@/components/RcaiChat/RcaiStreamedMarkdown";
import RcaiThinking from "@/components/RcaiChat/RcaiThinking";
import { Avatar } from "@/components/ui/Avatar";
import { scrollToBottom } from "@/lib/scrollUtils";
import type { Message } from "@/types/chat";

function SendingSpinner({ showTurtle }: { showTurtle: boolean }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">
          Generating response...
          {showTurtle ? " \uD83D\uDC22" : null}
        </p>
      </div>
    </div>
  );
}

export default function RcaiChatMessages({
  messages,
  isMessagesLoading,
  isGeneratingAIResponse,
  messagesEndRef,
  streamingMessageId,
  progressText,
  showTurtle,
  hasAssistantOutputStarted,
}: {
  messages: Message[];
  isMessagesLoading: boolean;
  isGeneratingAIResponse: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamingMessageId: string | null;
  progressText: string | null;
  showTurtle: boolean;
  hasAssistantOutputStarted: boolean;
}) {
  const { data: session } = useSession();

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

  return (
    <div className="px-4 py-4 lg:p-6 3xl:px-0 3xl:py-6 space-y-7.5 max-w-4xl mx-auto">
      {isMessagesLoading && sortedMessages.length === 0 ? (
        <div className="text-gray-600">Loading…</div>
      ) : null}

      {sortedMessages.map((message) => {
        if (message.type === "user") {
          return (
            <div
              key={message.id}
              className="flex justify-end items-end gap-3 sm:gap-4"
            >
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
          );
        }

        return (
          <div
            key={message.id}
            className="w-full max-w-full space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6"
          >
            <div className="text-xs text-slate-500">DataGems AI</div>
            <div className="text-body-16-regular text-gray-750 break-words overflow-hidden">
              {streamingMessageId === message.id ? (
                <RcaiStreamedMarkdown
                  messageId={message.id}
                  content={message.content}
                  isStreaming={true}
                  statusText={
                    !hasAssistantOutputStarted
                      ? progressText
                        ? `${progressText}${showTurtle ? " \uD83D\uDC22" : ""}`
                        : showTurtle
                          ? "\uD83D\uDC22"
                          : null
                      : null
                  }
                  onTick={() => {
                    if (messagesEndRef.current) {
                      scrollToBottom(messagesEndRef.current, {
                        behavior: "auto",
                        retryDelays: [],
                      });
                    }
                  }}
                />
              ) : (
                <RcaiMarkdown content={message.content} />
              )}
            </div>
          </div>
        );
      })}

      {isGeneratingAIResponse &&
      !streamingMessageId &&
      !hasAssistantOutputStarted &&
      progressText ? (
        <div className="w-full max-w-full space-y-4 shadow-s1 border border-slate-350 rounded-2xl px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6">
          <div className="text-xs text-slate-500">DataGems AI</div>
          <RcaiThinking
            text={progressText + (showTurtle ? " \uD83D\uDC22" : "")}
          />
        </div>
      ) : null}

      {isGeneratingAIResponse &&
      !streamingMessageId &&
      !hasAssistantOutputStarted &&
      !progressText ? (
        <SendingSpinner showTurtle={showTurtle} />
      ) : null}

      <div ref={messagesEndRef} />
    </div>
  );
}
