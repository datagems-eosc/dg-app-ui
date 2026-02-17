"use client";

import { useParams } from "next/navigation";
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedPage from "@/components/ProtectedPage";
import RcaiChat from "@/components/RcaiChat/RcaiChat";
import { RcaiChatSessionProvider } from "@/contexts/RcaiChatSessionContext";

export default function ChatRcaiSessionPage() {
  const params = useParams();
  const id = String(params?.id || "");

  return (
    <ProtectedPage>
      <DashboardLayout>
        <RcaiChatSessionProvider initialSessionId={id}>
          <RcaiChat />
        </RcaiChatSessionProvider>
      </DashboardLayout>
    </ProtectedPage>
  );
}
