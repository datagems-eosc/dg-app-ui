"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface RcaiChatSessionContextType {
  sessionId: string;
  setSessionId: (id: string) => void;
}

const RcaiChatSessionContext = createContext<RcaiChatSessionContextType | null>(
  null,
);

export function RcaiChatSessionProvider({
  children,
  initialSessionId,
}: {
  children: React.ReactNode;
  initialSessionId?: string;
}) {
  const [sessionId, setSessionId] = useState<string>(
    initialSessionId ||
      (typeof crypto !== "undefined" ? crypto.randomUUID() : ""),
  );

  useEffect(() => {
    if (!initialSessionId) return;
    setSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem("rcaiCurrentChatSessionId", sessionId);
      localStorage.setItem("rcaiActiveSessionId", sessionId);
      (window as any).rcaiChatSessionId = sessionId;
    } catch {
      // ignore
    }
  }, [sessionId]);

  const value = useMemo(() => ({ sessionId, setSessionId }), [sessionId]);

  return (
    <RcaiChatSessionContext.Provider value={value}>
      {children}
    </RcaiChatSessionContext.Provider>
  );
}

export function useRcaiChatSession(): RcaiChatSessionContextType {
  const ctx = useContext(RcaiChatSessionContext);
  if (!ctx) {
    throw new Error(
      "useRcaiChatSession must be used within RcaiChatSessionProvider",
    );
  }
  return ctx;
}
