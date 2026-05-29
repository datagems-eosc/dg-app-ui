"use client";

import { Suspense } from "react";
import { ChatPageContent } from "../ChatPageContent";

export default function ConversationChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent
        showConversationName={false}
        hideCollectionActions={true}
        withLayout={true}
      />
    </Suspense>
  );
}
