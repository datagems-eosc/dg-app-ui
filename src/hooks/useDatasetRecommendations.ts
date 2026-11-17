"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";

type Request = ReturnType<typeof useApi>["getDatasetRecommendations"];

/**
 * The recommendations for a dataset, or null while they load (including
 * while the session has no token yet).
 *
 * A refreshed session token is no reason to ask again, with one exception: an
 * expired token is refused like a dataset the user cannot open, so after a
 * no-access answer each newer token gets one try.
 */
export function useDatasetRecommendations(
  datasetId: string,
): DatasetRecommendationsResult | null {
  const { getDatasetRecommendations, hasToken } = useApi();
  // The adapter changes with every session token; keep the latest without
  // making it a request dependency.
  const requestRef = useRef(getDatasetRecommendations);
  useEffect(() => {
    requestRef.current = getDatasetRecommendations;
  });
  // Kept with the dataset it answers, so an answer never shows on another
  // dataset's page, and with the adapter (token) that got it.
  const [answer, setAnswer] = useState<{
    datasetId: string;
    result: DatasetRecommendationsResult;
    via: Request;
  } | null>(null);

  const current = answer?.datasetId === datasetId ? answer : null;
  // A no-access answer is final only when the token in use now got it.
  const needsRequest =
    current === null ||
    (current.result.status === "noAccess" &&
      current.via !== getDatasetRecommendations);

  // `current` is a dependency so that every new answer is checked again.
  useEffect(() => {
    if (!datasetId || !hasToken || !needsRequest) return;
    const send = requestRef.current;
    let cancelled = false;
    send(datasetId).then((result) => {
      if (!cancelled) setAnswer({ datasetId, result, via: send });
    });
    return () => {
      cancelled = true;
    };
  }, [datasetId, hasToken, needsRequest, current]);

  return current?.result ?? null;
}
