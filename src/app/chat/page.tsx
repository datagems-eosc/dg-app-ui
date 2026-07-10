"use client";

import { Suspense } from "react";
import { FeatureFlagGuard } from "@/components/FeatureFlagGuard/FeatureFlagGuard";
import type { ConversationMessage } from "./ChatPageContent";
import { ChatPageContent } from "./ChatPageContent";

export type { ConversationMessage };

export default function ChatPage() {
  return (
    <FeatureFlagGuard flag="generalChat" invert>
      <Suspense fallback={<div>Loading...</div>}>
        <ChatPageContent
          showConversationName={true}
          hideCollectionActions={false}
          withLayout={true}
        />
      </Suspense>
    </FeatureFlagGuard>
  );
}
