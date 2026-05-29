"use client";

import { Suspense } from "react";
import { ChatPageContent } from "@/app/chat/page";
import { useCollections } from "@/contexts/CollectionsContext";

function WeatherChatInner() {
  const { collections } = useCollections();
  const weatherCollection = collections.find(
    (c) => c.name?.toLowerCase().trim() === "meteo",
  );

  return (
    <ChatPageContent
      withLayout={false}
      forcedCollectionId={weatherCollection?.id ?? null}
      showConversationName={false}
      hideCollectionActions={true}
    />
  );
}

export default function WeatherChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WeatherChatInner />
    </Suspense>
  );
}
