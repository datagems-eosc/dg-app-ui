"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import { useApi } from "@/hooks/useApi";
import { handoffStore } from "@/lib/intentRouting/handoffStore";
import type { IntentHandoff } from "@/lib/intentRouting/types";
import { getNavigationUrl } from "@/lib/utils";
import { HomeQueryEntry } from "./HomeQueryEntry";
import { useHomeQuery } from "./useHomeQuery";

export const HANDOFF_PARAM = "handoff";

const DESTINATION = {
  dataset_search: APP_ROUTES.BROWSE,
  question: APP_ROUTES.CHAT,
} as const;

/**
 * Home query entry: classifies once, then hands the request to Browse or chat.
 * Only an opaque handoff id goes into the URL; the destination view owns its
 * own request, loading and errors.
 */
export function HomeQuery() {
  const { classifyIntent } = useApi();
  const router = useRouter();

  const onNavigate = useCallback(
    (handoff: IntentHandoff) => {
      const id = handoffStore.create(handoff);
      router.push(
        getNavigationUrl(
          `${DESTINATION[handoff.intent]}?${HANDOFF_PARAM}=${encodeURIComponent(id)}`,
        ),
      );
    },
    [router],
  );

  const { state, setText, submit, cancel, choose, retry } = useHomeQuery({
    classify: classifyIntent,
    onNavigate,
  });

  return (
    <HomeQueryEntry
      state={state}
      onTextChange={setText}
      onSubmit={() => void submit()}
      onCancel={cancel}
      onChoose={choose}
      onRetry={() => void retry()}
    />
  );
}
