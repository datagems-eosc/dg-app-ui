"use client";

import { Suspense } from "react";
import { ChatPageContent } from "@/app/chat/page";
import { useCollections } from "@/contexts/CollectionsContext";

function MathChatInner() {
  const { collections } = useCollections();
  const mathCollection = collections.find(
    (c) => c.name?.toLowerCase().trim() === "math",
  );

  return (
    <ChatPageContent
      withLayout={false}
      forcedCollectionId={mathCollection?.id ?? null}
      showConversationName={false}
      hideCollectionActions={true}
    />
  );
}

export default function MathChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MathChatInner />
    </Suspense>
  );
}
