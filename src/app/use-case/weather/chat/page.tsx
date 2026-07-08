"use client";

import { Suspense } from "react";
import { ChatPageContent } from "@/app/chat/ChatPageContent";
import { useCollections } from "@/contexts/CollectionsContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

function WeatherChatInner() {
  const { collections } = useCollections();
  const { flags, datasetIds } = useFeatureFlags();

  const weatherCollection = collections.find(
    (c) => c.name?.toLowerCase().trim() === "meteo",
  );

  const pinnedDatasetId =
    flags.pinnedDatasetWeather && datasetIds.pinnedDatasetWeather
      ? datasetIds.pinnedDatasetWeather
      : null;

  return (
    <ChatPageContent
      withLayout={false}
      forcedCollectionId={
        pinnedDatasetId ? null : (weatherCollection?.id ?? null)
      }
      forcedDatasetIds={pinnedDatasetId ? [pinnedDatasetId] : undefined}
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
