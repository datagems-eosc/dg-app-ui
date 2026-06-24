"use client";

import { Suspense } from "react";
import type { ConversationMessage } from "./ChatPageContent";
import { ChatPageContent } from "./ChatPageContent";

export type { ConversationMessage };

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent
        showConversationName={true}
        hideCollectionActions={false}
        withLayout={true}
      />
    </Suspense>
  );
}
