"use client";

import { Suspense } from "react";
import { FeatureFlagGuard } from "@/components/FeatureFlagGuard/FeatureFlagGuard";
import { ChatPageContent } from "../ChatPageContent";

export default function ConversationChatPage() {
  return (
    <FeatureFlagGuard flag="generalChat" invert>
      <Suspense fallback={<div>Loading...</div>}>
        <ChatPageContent
          showConversationName={false}
          hideCollectionActions={true}
          withLayout={true}
        />
      </Suspense>
    </FeatureFlagGuard>
  );
}
