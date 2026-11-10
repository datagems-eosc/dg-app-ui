"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logWarn } from "@/lib/logger";

const DETAIL_FIELDS = [
  "id",
  "code",
  "name",
  "description",
  "size",
  "datePublished",
  "collections.id",
  "collections.code",
  "collections.name",
  "collections.datasetCount",
  "permissions.browseDataset",
  "permissions.editDataset",
];

/**
 * Details for the given dataset ids, loaded by id and kept per id, so a
 * response that arrives late can only add datasets, never replace newer ones.
 */
export function useDatasetDetails(ids: string[]): Dataset[] {
  const api = useApi();
  // useApi returns a new object on every render; keep the latest without
  // making it an effect dependency, or a failed request would retry per render.
  const apiRef = useRef(api);
  apiRef.current = api;
  const hasToken = api.hasToken;
  const [byId, setById] = useState<Record<string, Dataset>>({});
  const requested = useRef(new Set<string>());
  const key = ids.join(",");

  useEffect(() => {
    if (!key || !hasToken) return;
    const missing = key.split(",").filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.current.add(id);

    apiRef.current
      .queryDatasets({
        project: { fields: DETAIL_FIELDS },
        ids: missing,
        page: { Offset: 0, Size: missing.length },
        Order: { Items: ["+code"] },
        Metadata: { CountAll: true },
      })
      .then((data: { items?: Dataset[] }) => {
        setById((current) => {
          const next = { ...current };
          for (const dataset of data.items ?? []) next[dataset.id] = dataset;
          return next;
        });
      })
      .catch(() => {
        // Forget these ids so the next change of the list asks for them again.
        for (const id of missing) requested.current.delete(id);
        logWarn("Dataset details could not be loaded", {
          count: missing.length,
        });
      });
  }, [key, hasToken]);

  return useMemo(
    () =>
      key ? key.split(",").flatMap((id) => (byId[id] ? [byId[id]] : [])) : [],
    [key, byId],
  );
}
