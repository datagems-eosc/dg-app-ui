"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";

type Api = ReturnType<typeof useApi>;
type Request = Api["getDatasetRecommendations"];

/**
 * The recommendations for a dataset, or null while they load (including
 * while the session has no token yet).
 *
 * The dataset's feature status is read first: when it says the recommender
 * does not know the dataset, the recommender is not asked. Any other status,
 * or none (refused, failed, missing), leads to the request as before.
 *
 * A refreshed session token is no reason to ask again, with one exception: an
 * expired token is refused like a dataset the user cannot open, so after a
 * no-access answer each newer token gets one try.
 */
export function useDatasetRecommendations(
  datasetId: string,
): DatasetRecommendationsResult | null {
  const { getDatasetRecommendations, getDatasetFeatures, hasToken } = useApi();
  // The adapters change with every session token; keep the latest without
  // making them request dependencies.
  const requestRef = useRef(getDatasetRecommendations);
  const featuresRef = useRef<Api["getDatasetFeatures"]>(getDatasetFeatures);
  useEffect(() => {
    requestRef.current = getDatasetRecommendations;
    featuresRef.current = getDatasetFeatures;
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
    const readFeatures = featuresRef.current;
    // Leaving the page or the dataset cancels the requests still running: the
    // first recommend answer can take about 40 seconds.
    const controller = new AbortController();
    const { signal } = controller;
    // Backstop only: the adapters never reject. If one did, the section must
    // not stay loading.
    const ask = async (): Promise<DatasetRecommendationsResult | null> => {
      const features = await readFeatures(datasetId, { signal }).catch(
        () => null,
      );
      if (signal.aborted) return null;
      if (features?.recommendation === false) return { status: "notKnown" };
      return send(datasetId, { signal }).catch(
        () => ({ status: "failed" }) as const,
      );
    };
    ask().then((result) => {
      if (result && !signal.aborted) {
        setAnswer({ datasetId, result, via: send });
      }
    });
    return () => {
      controller.abort();
    };
  }, [datasetId, hasToken, needsRequest, current]);

  // A refusal stays up while a newer token is tried: the token rotates every
  // few minutes, and a refused page must not flash loading each time.
  return current?.result ?? null;
}
