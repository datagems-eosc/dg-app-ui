"use client";

import { useParams } from "next/navigation";
import React from "react";
import RcaiChat from "@/components/Chat/RcaiChat";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedPage from "@/components/ProtectedPage";

export default function ChatRcaiSessionPage() {
  const params = useParams();
  const id = String(params?.id || "");

  return (
    <ProtectedPage>
      <DashboardLayout>
        <RcaiChat rcaiSessionId={id} showConversationName={true} />
      </DashboardLayout>
    </ProtectedPage>
  );
}
