"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedPage from "@/components/ProtectedPage";

export default function ChatRcaiIndexPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const id = crypto.randomUUID();
    router.replace(`/chat-rcai/${id}`);
  }, [status, router]);

  return (
    <ProtectedPage>
      <DashboardLayout>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    </ProtectedPage>
  );
}
