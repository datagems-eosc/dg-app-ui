"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";

export interface CollectionPickerItem {
  id: string;
  name: string;
}
type Status = "idle" | "loading" | "ready" | "error";
interface PickerState {
  owner: string;
  status: Status;
  items: CollectionPickerItem[];
}

export function useCollectionPicker({
  enabled,
  scopeKey,
}: {
  enabled: boolean;
  scopeKey: string;
}) {
  const api = useApi();
  const queryRef = useRef(api.queryUserCollections);
  useEffect(() => {
    queryRef.current = api.queryUserCollections;
  }, [api.queryUserCollections]);
  const principal =
    enabled && api.hasToken ? api.datasetPermissions.scope : null;
  const owner =
    enabled && api.hasToken && principal
      ? JSON.stringify([
          principal.gatewayOrigin,
          principal.principalId,
          scopeKey,
        ])
      : "";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PickerState>({
    owner: "",
    status: "idle",
    items: [],
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!owner) {
      setState({ owner: "", status: "idle", items: [] });
      return;
    }
    let cancelled = false;
    setState({ owner, status: "loading", items: [] });
    async function load() {
      try {
        const items: CollectionPickerItem[] = [];
        const ids = new Set<string>();
        while (!cancelled) {
          const data = await queryRef.current({
            project: { fields: ["id", "name"] },
            page: { Offset: items.length, Size: 100 },
            Order: { Items: ["+name", "+id"] },
            Metadata: { CountAll: true },
          });
          if (cancelled) return;
          if (
            !data ||
            !Array.isArray(data.items) ||
            !Number.isInteger(data.count) ||
            data.count < 0
          )
            throw new Error("Invalid collection list response");
          for (const item of data.items) {
            if (
              !item ||
              typeof item.id !== "string" ||
              !item.id ||
              typeof item.name !== "string" ||
              ids.has(item.id)
            )
              throw new Error("Invalid or repeated collection");
            ids.add(item.id);
            items.push({
              id: item.id,
              name: item.name,
            });
          }
          if (items.length > data.count)
            throw new Error("Invalid collection count");
          if (items.length === data.count) break;
          if (!data.items.length) throw new Error("Incomplete collection list");
        }
        if (!cancelled) setState({ owner, status: "ready", items });
      } catch {
        if (!cancelled) setState({ owner, status: "error", items: [] });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [owner, attempt]);
  return {
    ...(state.owner === owner && owner
      ? state
      : {
          owner,
          status: owner ? ("loading" as const) : ("idle" as const),
          items: [],
        }),
    retry,
  };
}
