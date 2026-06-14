"use client";

import { Suspense } from "react";
import { ChatPageContent } from "@/app/chat/ChatPageContent";
import { useCollections } from "@/contexts/CollectionsContext";

// Set to a specific dataset ID to restrict the chat to that dataset,
// or null to use all datasets from the meteo collection.
const PINNED_DATASET_ID: string | null = "3166e649-54c1-4ebf-904e-de9a46cb1b18";

function WeatherChatInner() {
  const { collections } = useCollections();
  const weatherCollection = collections.find(
    (c) => c.name?.toLowerCase().trim() === "meteo",
  );

  return (
    <ChatPageContent
      withLayout={false}
      forcedCollectionId={weatherCollection?.id ?? null}
      forcedDatasetIds={PINNED_DATASET_ID ? [PINNED_DATASET_ID] : undefined}
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
