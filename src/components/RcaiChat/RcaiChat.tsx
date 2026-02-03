"use client";

import { getSession, useSession } from "next-auth/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import RcaiChatMessages from "@/components/RcaiChat/RcaiChatMessages";
import { ChatInput } from "@/components/ui/chat/ChatInput";
import { useRcaiChatSession } from "@/contexts/RcaiChatSessionContext";
import { logError } from "@/lib/logger";
import { buildRcaiApiUrl, buildRcaiWebSocketUrl } from "@/lib/rcai";
import type { Message } from "@/types/chat";

type RcaiChatHistoryResponse = {
  session_id?: string;
  title?: string;
  num_messages?: number;
  messages?: Array<{ id: string; content: string; role: string }>;
};

function makeOrderedTimestamp(index: number): string {
  const base = new Date(0);
  return new Date(base.getTime() + index).toISOString();
}

export default function RcaiChat() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const { sessionId } = useRcaiChatSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [chatTitle, setChatTitle] = useState<string>("Untitled");
  const [progressText, setProgressText] = useState<string | null>(null);
  const [showTurtle, setShowTurtle] = useState(false);
  const [hasAssistantOutputStarted, setHasAssistantOutputStarted] =
    useState(false);

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
    // eslint-disable-next-line no-console
    console.debug(...args);
  };

  const isGeneratingRef = useRef(false);
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) {
      setShowTurtle(false);
      return;
    }

    setShowTurtle(false);
    const t = window.setTimeout(() => {
      setShowTurtle(true);
    }, 15000);

    return () => {
      window.clearTimeout(t);
    };
  }, [isGenerating]);

  const wsRef = useRef<WebSocket | null>(null);
  const assistantBuffersRef = useRef<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canConnect = useMemo(
    () => Boolean(token && sessionId),
    [token, sessionId],
  );

  // Load history for current session
  useEffect(() => {
    if (!token || !sessionId) return;

    let cancelled = false;
    const load = async () => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const url = buildRcaiApiUrl(`/chats/${encodeURIComponent(sessionId)}/`);

        const fetchHistory = async (accessToken: string) =>
          fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });

        let resp = await fetchHistory(token);

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
            assistantBuffersRef.current = {};
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

        const data = (await resp.json()) as RcaiChatHistoryResponse;
        const rawMessages = Array.isArray(data.messages) ? data.messages : [];

        const mapped: Message[] = rawMessages
          .filter((m) => m && m.role !== "tool")
          .map((m, idx) => ({
            id: String(m.id),
            type: m.role === "user" ? "user" : "ai",
            content: m.content || "",
            timestamp: makeOrderedTimestamp(idx),
          }));

        if (!cancelled) {
          setMessages(mapped);
          assistantBuffersRef.current = {};
        }
      } catch (e) {
        logError("RCAI: failed to load history", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load history");
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  // WebSocket connect
  useEffect(() => {
    if (!token || !sessionId) return;

    const wsUrl = buildRcaiWebSocketUrl(token);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setError(null);

        // Subscribe/connect to session immediately so we don't miss streamed events.
        try {
          ws.send(
            JSON.stringify({
              session_id: sessionId,
            }),
          );
        } catch {
          // ignore
        }

        debugLog("[RCAI][WS] open", { sessionId });
      };

      ws.onerror = () => {
        setError("WebSocket error");
      };

      ws.onclose = () => {
        // Keep a user-visible error only if we are mid-generation
        if (isGeneratingRef.current) {
          setError("Connection lost");
          setIsGenerating(false);
          setStreamingMessageId(null);
          setProgressText(null);
        }

        debugLog("[RCAI][WS] close", {
          sessionId,
          isGenerating: isGeneratingRef.current,
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          const msgSessionId =
            typeof data?.session_id === "string" ? data.session_id : null;
          if (msgSessionId && msgSessionId !== sessionId) {
            debugLog("[RCAI][WS] ignore other session", {
              msgSessionId,
              sessionId,
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

            const prev = assistantBuffersRef.current[messageId] || "";
            const next = prev + textChunk;
            assistantBuffersRef.current[messageId] = next;

            debugLog("[RCAI][WS] assistant_message", {
              messageId,
              chunkLen: textChunk.length,
              totalLen: next.length,
              isComplete,
            });

            if (textChunk.trim().length > 0) {
              setHasAssistantOutputStarted(true);
              setProgressText(null);
            }

            if (!isComplete) {
              setStreamingMessageId(messageId);
            }

            setMessages((current) => {
              const idx = current.findIndex((m) => m.id === messageId);
              if (idx >= 0) {
                const updated = [...current];
                updated[idx] = {
                  ...updated[idx],
                  content: next,
                };
                return updated;
              }

              return [
                ...current,
                {
                  id: messageId,
                  type: "ai",
                  content: next,
                  timestamp: new Date().toISOString(),
                },
              ];
            });

            if (isComplete) {
              setIsGenerating(false);
              setStreamingMessageId((current) =>
                current === messageId ? null : current,
              );
              setProgressText(null);
              setShowTurtle(false);
              setHasAssistantOutputStarted(false);
            }

            return;
          }

          if (data?.type === "chat_title_update") {
            const title = String(data.title || "").trim();
            if (title) {
              debugLog("[RCAI][WS] chat_title_update", { title, sessionId });
              setChatTitle(title);
              if (typeof document !== "undefined") {
                document.title = title;
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("chat-title-update", {
                    detail: {
                      session_id: sessionId,
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
              debugLog("[RCAI][WS] progress", {
                status,
                detail,
                nextText,
                sessionId,
              });
              if (!hasAssistantOutputStarted) {
                setProgressText(nextText);
              }
            }
            return;
          }

          if (data?.type === "status_update") {
            // Backend emits statuses like: processing / waiting_for_input
            const status = String(data.status || "");
            if (status === "waiting_for_input") {
              debugLog("[RCAI][WS] status_update waiting_for_input", {
                sessionId,
              });
              setIsGenerating(false);
              setProgressText(null);
              setShowTurtle(false);
              setHasAssistantOutputStarted(false);
            }
            return;
          }

          if (data?.type === "error") {
            const errorText = String(data.error || data.message || "Error");
            debugLog("[RCAI][WS] error", { errorText, sessionId });
            setError(errorText);
            setIsGenerating(false);
            setStreamingMessageId(null);
            setProgressText(null);
            setShowTurtle(false);
            setHasAssistantOutputStarted(false);

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
          ws.close();
        } catch {
          // ignore
        }
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };
    } catch (e) {
      logError("RCAI: WS connect error", e);
      setError("Failed to connect");
    }
  }, [token, sessionId]);

  const send = () => {
    if (!token) {
      setError("Missing auth token");
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return;
    }

    const content = inputValue.trim();
    if (!content) return;

    setError(null);
    setIsGenerating(true);
    setShowTurtle(false);
    setHasAssistantOutputStarted(false);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      type: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMsg]);
    setInputValue("");

    ws.send(
      JSON.stringify({
        message: content,
        session_id: sessionId,
      }),
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 pt-4 max-w-4xl mx-auto w-full">
        <div className="text-sm text-slate-500">{chatTitle}</div>
      </div>
      <div className="flex-1">
        <RcaiChatMessages
          messages={messages}
          isMessagesLoading={isLoadingHistory}
          isGeneratingAIResponse={isGenerating}
          messagesEndRef={messagesEndRef}
          streamingMessageId={streamingMessageId}
          progressText={progressText}
          showTurtle={showTurtle}
          hasAssistantOutputStarted={hasAssistantOutputStarted}
        />
      </div>

      <div className="px-4 py-4 max-w-4xl mx-auto w-full">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={send}
          onAddDatasets={() => {}}
          isLoading={isGenerating}
          disabled={!canConnect}
          error={error}
          showCollectionsButton={false}
        />
      </div>
    </div>
  );
}
