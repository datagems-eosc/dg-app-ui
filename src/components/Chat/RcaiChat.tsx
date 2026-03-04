"use client";

import ChatInitialView from "@ui/chat/ChatInitialView";
import { ChatInput, type ChatInputRef } from "@ui/chat/ChatInput";
import { ChatMessagesSkeleton } from "@ui/chat/ChatMessagesSkeleton";
import { getSession, useSession } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";
import RcaiChatMessages from "@/components/RcaiChat/RcaiChatMessages";
import { logError } from "@/lib/logger";
import { buildRcaiApiUrl, buildRcaiWebSocketUrl } from "@/lib/rcai";
import { scrollToBottom } from "@/lib/scrollUtils";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date | string;
}

interface RcaiChatProps {
  rcaiSessionId: string;
  showConversationName?: boolean;
}

export default function RcaiChat({
  rcaiSessionId,
  showConversationName = true,
}: RcaiChatProps) {
  const { data: session } = useSession();
  const rcaiToken = (session as any)?.accessToken as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isGeneratingAIResponse, setIsGeneratingAIResponse] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const [, setRcaiChatTitle] = useState<string>("Untitled");
  const [rcaiStreamingMessageId, setRcaiStreamingMessageId] = useState<
    string | null
  >(null);
  const [rcaiStreamingMessageCompleteId, setRcaiStreamingMessageCompleteId] =
    useState<string | null>(null);
  const [rcaiProgressText, setRcaiProgressText] = useState<string | null>(null);
  const [rcaiThinkingSteps, setRcaiThinkingSteps] = useState<string[]>([]);
  const [rcaiThinkingExpanded, setRcaiThinkingExpanded] = useState(false);
  const [rcaiHasAssistantOutputStarted, setRcaiHasAssistantOutputStarted] =
    useState(false);
  const [rcaiShowTurtle, setRcaiShowTurtle] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatInputRef = React.useRef<ChatInputRef>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const debugEnabledRef = useRef(false);
  useEffect(() => {
    try {
      debugEnabledRef.current =
        typeof window !== "undefined" &&
        window.localStorage.getItem("rcaiDebug") === "1";
    } catch {
      debugEnabledRef.current = false;
    }
  }, []);

  const debugLog = (...args: any[]) => {
    if (!debugEnabledRef.current) return;
    console.debug(...args);
  };

  const rcaiWsRef = useRef<WebSocket | null>(null);
  const assistantBuffersRef = useRef<Map<string, string>>(new Map());
  const assistantLastChunkRef = useRef<Map<string, string>>(new Map());
  const isGeneratingRef = useRef(false);
  const hasAssistantOutputStartedRef = useRef(false);
  const wsUrlRef = useRef<string | null>(null);
  const activeWsIdRef = useRef(0);
  const latestSessionIdRef = useRef(rcaiSessionId);
  const subscribedSessionIdRef = useRef<string | null>(null);
  const subscribedWsIdRef = useRef<number | null>(null);

  const mergeStreamText = (prev: string, incoming: string) => {
    if (!incoming) return prev;
    if (!prev) return incoming;

    // Retransmitted suffix (common when backend re-sends the last fragment)
    if (prev.endsWith(incoming)) return prev;

    const incomingTrimStart = incoming.trimStart();
    if (incomingTrimStart && incomingTrimStart !== incoming) {
      if (prev.endsWith(incomingTrimStart)) return prev;
    }

    // Cumulative payload (full text so far)
    if (incoming.startsWith(prev)) return incoming;

    // Retransmit/partial payload
    if (prev.startsWith(incoming)) return prev;

    const maxOverlap = Math.min(prev.length, incoming.length);
    const minOverlap = 3;
    let overlap = 0;
    for (let i = maxOverlap; i >= minOverlap; i -= 1) {
      if (prev.slice(-i) === incoming.slice(0, i)) {
        overlap = i;
        break;
      }
    }

    if (overlap === 0 && incomingTrimStart && incomingTrimStart !== incoming) {
      const leadingLen = incoming.length - incomingTrimStart.length;
      const maxOverlapTrimmed = Math.min(prev.length, incomingTrimStart.length);
      for (let i = maxOverlapTrimmed; i >= minOverlap; i -= 1) {
        if (prev.slice(-i) === incomingTrimStart.slice(0, i)) {
          overlap = i;
          return (
            prev +
            incoming.slice(0, leadingLen) +
            incomingTrimStart.slice(overlap)
          );
        }
      }
    }

    return prev + incoming.slice(overlap);
  };

  const stripThinkingTags = (value: string) =>
    value
      .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, "")
      .replace(/<thinking[^>]*>/gi, "")
      .replace(/<\/thinking>/gi, "");

  useEffect(() => {
    isGeneratingRef.current = isGeneratingAIResponse;
  }, [isGeneratingAIResponse]);

  useEffect(() => {
    if (!isGeneratingAIResponse) return;
    if (rcaiHasAssistantOutputStarted) return;
    if (!messagesEndRef.current) return;

    requestAnimationFrame(() => {
      scrollToBottom(messagesEndRef.current, {
        behavior: "auto",
        retryDelays: [],
      });
    });
  }, [
    isGeneratingAIResponse,
    rcaiHasAssistantOutputStarted,
    rcaiThinkingSteps.length,
    rcaiProgressText,
  ]);

  useEffect(() => {
    hasAssistantOutputStartedRef.current = rcaiHasAssistantOutputStarted;
  }, [rcaiHasAssistantOutputStarted]);

  useEffect(() => {
    if (!isGeneratingAIResponse) return;
    if (!rcaiStreamingMessageId) return;

    const streamingMessage = messages.find(
      (m) => m.id === rcaiStreamingMessageId,
    );
    const hasDisplayableOutput = Boolean(
      streamingMessage &&
        stripThinkingTags(streamingMessage.content).trim().length > 0,
    );

    if (!hasDisplayableOutput) return;
    if (hasAssistantOutputStartedRef.current) return;

    setRcaiHasAssistantOutputStarted(true);
  }, [isGeneratingAIResponse, messages, rcaiStreamingMessageId]);

  useEffect(() => {
    latestSessionIdRef.current = rcaiSessionId;
  }, [rcaiSessionId]);

  useEffect(() => {
    setHasLoadedHistory(false);
    setRcaiStreamingMessageId(null);
    setRcaiStreamingMessageCompleteId(null);
    setRcaiProgressText(null);
    setRcaiThinkingSteps([]);
    setRcaiThinkingExpanded(false);
    setRcaiShowTurtle(false);
    setRcaiHasAssistantOutputStarted(false);
    assistantBuffersRef.current = new Map();
    assistantLastChunkRef.current = new Map();
  }, [rcaiSessionId]);

  useEffect(() => {
    if (!isGeneratingAIResponse) {
      setRcaiShowTurtle(false);
      return;
    }

    setRcaiShowTurtle(false);
    const t = window.setTimeout(() => {
      setRcaiShowTurtle(true);
    }, 15000);

    return () => {
      window.clearTimeout(t);
    };
  }, [isGeneratingAIResponse]);

  useEffect(() => {
    if (!rcaiToken || !rcaiSessionId) return;

    let cancelled = false;

    const load = async () => {
      setIsMessagesLoading(true);
      setError(null);
      setHasLoadedHistory(false);

      try {
        const url = buildRcaiApiUrl(
          `/chats/${encodeURIComponent(rcaiSessionId)}/`,
        );

        const fetchHistory = async (accessToken: string) =>
          fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });

        let resp = await fetchHistory(rcaiToken);

        if (resp.status === 403) {
          let body = "";
          try {
            body = await resp.text();
          } catch {
            body = "";
          }

          if (body.includes("Token expired")) {
            const refreshed = await getSession();
            const refreshedToken = (refreshed as any)?.accessToken as
              | string
              | undefined;
            if (refreshedToken) {
              resp = await fetchHistory(refreshedToken);
            }
          }
        }

        if (resp.status === 404) {
          if (!cancelled) {
            setMessages([]);
            assistantBuffersRef.current = new Map();
          }
          return;
        }

        if (!resp.ok) {
          let body = "";
          try {
            body = await resp.text();
          } catch {
            body = "";
          }
          const excerpt = body ? `: ${body.slice(0, 300)}` : "";
          throw new Error(`Failed to load history (${resp.status})${excerpt}`);
        }

        const data = (await resp.json()) as {
          title?: string;
          messages?: Array<{ id: string; content: string; role: string }>;
        };

        const rawMessages = Array.isArray(data.messages) ? data.messages : [];

        const mapped: Message[] = rawMessages
          .filter((m) => m && m.role !== "tool")
          .map((m, idx) => ({
            id: String(m.id),
            type: m.role === "user" ? "user" : "ai",
            content: m.content || "",
            timestamp: new Date(new Date(0).getTime() + idx).toISOString(),
          }));

        if (!cancelled) {
          setRcaiChatTitle(
            typeof data.title === "string" && data.title.trim().length > 0
              ? data.title
              : "Untitled",
          );
          setMessages(mapped);
          assistantBuffersRef.current = new Map();
        }
      } catch (e) {
        logError("RCAI: failed to load history", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load history");
        }
      } finally {
        if (!cancelled) {
          setIsMessagesLoading(false);
          setHasLoadedHistory(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [rcaiToken, rcaiSessionId]);

  useEffect(() => {
    if (!rcaiToken || !rcaiSessionId) return;
    if (!hasLoadedHistory) return;

    const wsUrl = buildRcaiWebSocketUrl(rcaiToken);
    const existing = rcaiWsRef.current;

    if (
      existing &&
      wsUrlRef.current === wsUrl &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (existing) {
      try {
        existing.close();
      } catch {
        // ignore
      }
      rcaiWsRef.current = null;
    }

    wsUrlRef.current = wsUrl;
    activeWsIdRef.current += 1;
    const wsId = activeWsIdRef.current;

    try {
      const ws = new WebSocket(wsUrl);
      rcaiWsRef.current = ws;

      ws.onopen = () => {
        if (activeWsIdRef.current !== wsId) return;
        setError(null);

        try {
          ws.send(
            JSON.stringify({
              session_id: latestSessionIdRef.current,
            }),
          );
          subscribedSessionIdRef.current = latestSessionIdRef.current;
          subscribedWsIdRef.current = wsId;
        } catch {
          // ignore
        }

        debugLog("[RCAI][WS] open", {
          rcaiSessionId: latestSessionIdRef.current,
        });
      };

      ws.onerror = () => {
        if (activeWsIdRef.current !== wsId) return;
        setError("WebSocket error");
      };

      ws.onclose = () => {
        if (activeWsIdRef.current !== wsId) return;
        if (rcaiWsRef.current === ws) rcaiWsRef.current = null;
        if (isGeneratingRef.current) {
          setError("Connection lost");
          setIsGeneratingAIResponse(false);
          setRcaiStreamingMessageId(null);
          setRcaiProgressText(null);
        }

        debugLog("[RCAI][WS] close", {
          rcaiSessionId: latestSessionIdRef.current,
          isGenerating: isGeneratingRef.current,
        });
      };

      ws.onmessage = (event) => {
        if (activeWsIdRef.current !== wsId) return;
        try {
          const data = JSON.parse(event.data);

          const msgSessionId =
            typeof data?.session_id === "string" ? data.session_id : null;
          if (msgSessionId && msgSessionId !== latestSessionIdRef.current) {
            debugLog("[RCAI][WS] ignore other session", {
              msgSessionId,
              rcaiSessionId: latestSessionIdRef.current,
              type: data?.type,
            });
            return;
          }

          debugLog("[RCAI][WS] message", {
            type: data?.type,
            session_id: msgSessionId,
          });

          if (data?.type === "assistant_message") {
            const messageId = String(data.message_id || "");
            const textChunk = String(data.text_chunk || "");
            const isComplete = Boolean(data.is_complete);

            if (!messageId) return;

            const wasGenerating = isGeneratingRef.current;

            // Backend may replay the latest assistant message on subscribe.
            // Only treat chunks as an active stream when we initiated a generation.
            if (wasGenerating) {
              setRcaiStreamingMessageId(messageId);
            }

            setMessages((current) => {
              const lastChunk = assistantLastChunkRef.current.get(messageId);
              if (textChunk.length > 0 && lastChunk === textChunk) {
                return current;
              }
              assistantLastChunkRef.current.set(messageId, textChunk);

              const idx = current.findIndex((m) => m.id === messageId);
              const existing = idx >= 0 ? current[idx] : null;

              const bufferedPrev = assistantBuffersRef.current.get(messageId);

              const prevBase =
                typeof bufferedPrev === "string"
                  ? bufferedPrev
                  : (existing?.content ?? "");

              const merged = mergeStreamText(prevBase, textChunk);

              debugLog("[RCAI][WS] merge", {
                messageId,
                prevLen: prevBase.length,
                incomingLen: textChunk.length,
                nextLen: merged.length,
                isComplete,
                prevTail: prevBase.slice(Math.max(0, prevBase.length - 60)),
                incomingHead: textChunk.slice(0, 60),
                incomingTail: textChunk.slice(
                  Math.max(0, textChunk.length - 60),
                ),
                nextTail: merged.slice(Math.max(0, merged.length - 60)),
              });
              assistantBuffersRef.current.set(messageId, merged);

              if (existing) {
                if (
                  !isGeneratingRef.current &&
                  merged.length <= existing.content.length
                ) {
                  return current;
                }

                if (merged === existing.content) return current;

                const updated = [...current];
                updated[idx] = {
                  ...existing,
                  content: merged,
                };
                return updated;
              }

              return [
                ...current,
                {
                  id: messageId,
                  type: "ai",
                  content: merged,
                  timestamp: new Date().toISOString(),
                },
              ];
            });

            if (isComplete) {
              setIsGeneratingAIResponse(false);
              if (wasGenerating) {
                setRcaiStreamingMessageCompleteId(messageId);
              }
              isGeneratingRef.current = false;
              setRcaiShowTurtle(false);
              assistantLastChunkRef.current.delete(messageId);
            }

            return;
          }

          if (data?.type === "chat_title_update") {
            const title = String(data.title || "").trim();
            if (title) {
              setRcaiChatTitle(title);
              if (typeof document !== "undefined") {
                document.title = title;
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("chat-title-update", {
                    detail: {
                      session_id: rcaiSessionId,
                      title,
                      updated_at: new Date().toISOString(),
                    },
                  }),
                );
              }
            }
            return;
          }

          if (data?.type === "progress") {
            const detail = String(data.detail || "").trim();
            const status = String(data.status || "").trim();

            const nextText = detail || status;
            if (nextText) {
              if (!hasAssistantOutputStartedRef.current) {
                setRcaiProgressText(nextText);
                setRcaiThinkingSteps((current) => {
                  if (
                    current.length > 0 &&
                    current[current.length - 1] === nextText
                  ) {
                    return current;
                  }
                  const next = [...current, nextText];
                  return next.length > 25 ? next.slice(-25) : next;
                });
              }
            }
            return;
          }

          if (data?.type === "status_update") {
            const status = String(data.status || "");
            if (status === "waiting_for_input") {
              isGeneratingRef.current = false;
              setIsGeneratingAIResponse(false);
              setRcaiShowTurtle(false);
              return;
            }

            const nextText = status.trim();
            if (nextText && !hasAssistantOutputStartedRef.current) {
              setRcaiProgressText(nextText);
              setRcaiThinkingSteps((current) => {
                if (
                  current.length > 0 &&
                  current[current.length - 1] === nextText
                ) {
                  return current;
                }
                const next = [...current, nextText];
                return next.length > 25 ? next.slice(-25) : next;
              });
            }
            return;
          }

          if (data?.type === "error") {
            const errorText = String(data.error || data.message || "Error");
            setError(errorText);
            setIsGeneratingAIResponse(false);
            setRcaiStreamingMessageId(null);
            setRcaiProgressText(null);
            setRcaiShowTurtle(false);
            setRcaiHasAssistantOutputStarted(false);

            setMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                type: "ai",
                content: `Error: ${errorText}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } catch (e) {
          logError("RCAI: failed to parse WS message", e);
        }
      };

      return () => {
        try {
          ws.onopen = null;
          ws.onerror = null;
          ws.onclose = null;
          ws.onmessage = null;
          ws.close();
        } catch {
          // ignore
        }
        if (rcaiWsRef.current === ws) {
          rcaiWsRef.current = null;
        }
      };
    } catch (e) {
      logError("RCAI: WS connect error", e);
      setError("Failed to connect");
    }
  }, [rcaiToken, hasLoadedHistory]);

  useEffect(() => {
    if (!rcaiSessionId) return;
    if (!hasLoadedHistory) return;
    const ws = rcaiWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const currentWsId = activeWsIdRef.current;
    if (
      subscribedWsIdRef.current === currentWsId &&
      subscribedSessionIdRef.current === rcaiSessionId
    ) {
      return;
    }
    try {
      ws.send(
        JSON.stringify({
          session_id: rcaiSessionId,
        }),
      );
      subscribedSessionIdRef.current = rcaiSessionId;
      subscribedWsIdRef.current = currentWsId;
    } catch {
      // ignore
    }
  }, [rcaiSessionId, hasLoadedHistory]);

  const handleSendMessage = async () => {
    const ws = rcaiWsRef.current;

    if (!rcaiToken) {
      setError("Missing auth token");
      return;
    }

    if (!rcaiSessionId) {
      setError("Missing session id");
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return;
    }

    const content = inputValue.trim();
    if (!content) return;

    setError(null);
    setIsLoading(true);
    setIsGeneratingAIResponse(true);
    isGeneratingRef.current = true;
    setRcaiShowTurtle(false);
    setRcaiStreamingMessageId(null);
    setRcaiStreamingMessageCompleteId(null);
    setRcaiHasAssistantOutputStarted(false);
    setRcaiProgressText(null);
    setRcaiThinkingSteps([]);
    setRcaiThinkingExpanded(false);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    try {
      ws.send(
        JSON.stringify({
          message: content,
          session_id: rcaiSessionId,
        }),
      );
    } catch (e) {
      logError("RCAI: failed to send message", e);
      setError("Failed to send message");
      setIsGeneratingAIResponse(false);
    } finally {
      setIsLoading(false);
    }
  };

  const isInputDisabled = isLoading || isGeneratingAIResponse;
  const isInitialState =
    messages.length === 0 && !isMessagesLoading && !isGeneratingAIResponse;

  return (
    <div className="relative">
      <div
        className={`flex-1 flex flex-col relative ${!isMessagesLoading ? "transition-all duration-500 ease-out" : ""}`}
        style={isMessagesLoading ? { transition: "none" } : undefined}
      >
        {/* <div className="bg-white flex-shrink-0 py-6 z-10">
          {showConversationName && (
            <div className="text-center py-4 px-6 border-b border-gray-100">
              {isMessagesLoading ? (
                <div className="h-6 bg-slate-200 rounded animate-pulse max-w-md mx-auto" />
              ) : (
                <h2 className="text-H2-20-semibold text-blue-700 truncate">
                  
                </h2>
              )}
            </div>
          )}
        </div> */}

        <div className="flex-1 bg-white pb-35 md:pb-40">
          {isMessagesLoading ? (
            <ChatMessagesSkeleton />
          ) : (
            (messages.length > 0 || isGeneratingAIResponse) && (
              <div
                className={`${messages.length === 0 && isGeneratingAIResponse ? "min-h-[200px]" : "min-h-0"}`}
              >
                <RcaiChatMessages
                  messages={messages}
                  isMessagesLoading={isMessagesLoading}
                  isGeneratingAIResponse={isGeneratingAIResponse}
                  messagesEndRef={messagesEndRef}
                  streamingMessageId={rcaiStreamingMessageId}
                  streamingMessageCompleteId={rcaiStreamingMessageCompleteId}
                  onStreamingMessageDone={(messageId) => {
                    setRcaiStreamingMessageId((current) =>
                      current === messageId ? null : current,
                    );
                    setRcaiStreamingMessageCompleteId((current) =>
                      current === messageId ? null : current,
                    );
                  }}
                  progressText={rcaiProgressText}
                  showTurtle={rcaiShowTurtle}
                  hasAssistantOutputStarted={rcaiHasAssistantOutputStarted}
                  thinkingSteps={rcaiThinkingSteps}
                  thinkingExpanded={rcaiThinkingExpanded}
                  onToggleThinkingExpanded={() =>
                    setRcaiThinkingExpanded((v) => !v)
                  }
                />
              </div>
            )
          )}
        </div>
      </div>

      {isInitialState && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none transition-all duration-500 ease-out pr-4 sm:pr-6"
          style={{
            left: "var(--sidebar-offset)",
            top: "100px",
            bottom: "200px",
          }}
        >
          <div className="pointer-events-auto">
            <ChatInitialView />
          </div>
        </div>
      )}

      {isInitialState && (
        <div
          className="fixed left-[var(--sidebar-offset)] right-0 px-4 sm:px-6 transition-all duration-500 ease-out pr-4 sm:pr-6"
          style={{ top: "50%", transform: "translateY(50px)" }}
        >
          <div className="w-full max-w-md sm:max-w-4xl mx-auto">
            <ChatInput
              ref={chatInputRef}
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onAddDatasets={() => {}}
              staticCollectionLabel="Meteo"
              isLoading={isLoading}
              disabled={isInputDisabled}
              error={error}
              showAddDatasetsModal={false}
              showCollectionsButton={false}
            />
          </div>
        </div>
      )}

      {!isInitialState && (
        <div className="fixed bottom-0 left-[var(--sidebar-offset)] right-0 px-4 sm:px-6 py-4 bg-white z-20 transition-all duration-500 ease-out pr-4 sm:pr-6">
          <div className="w-full max-w-md sm:max-w-4xl mx-auto">
            <ChatInput
              ref={chatInputRef}
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onAddDatasets={() => {}}
              staticCollectionLabel="Meteo"
              isLoading={isLoading}
              disabled={isInputDisabled}
              error={error}
              showAddDatasetsModal={false}
              showCollectionsButton={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
