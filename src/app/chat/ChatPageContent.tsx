"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Chat from "@/components/Chat";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedPage from "@/components/ProtectedPage";
import type { Dataset } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";

const API_DATASETS_PAYLOAD = {
  project: {
    fields: [
      "id",
      "code",
      "name",
      "description",
      "license",
      "size",
      "datePublished",
      "mimeType",
      "url",
      "version",
      "collections.id",
      "collections.code",
      "collections.name",
      "collections.datasetCount",
      "permissions.browseDataset",
      "permissions.editDataset",
    ],
  },
  page: { Offset: 0, Size: 100 },
  Order: { Items: ["-code"] },
  Metadata: { CountAll: true },
};

interface ConversationDataset {
  dataset: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ConversationMessage {
  id: string;
  conversation?: { id: string };
  kind: number;
  data: {
    kind: number;
    payload:
      | {
          query?: string;
          question?: string;
          entries?: Array<{
            result?: {
              table?: {
                columns: Array<{ columnNumber: number; name: string }>;
                rows: Array<{
                  rowNumber: number;
                  cells: Array<{ column: string; value: string | number }>;
                }>;
              };
            };
          }>;
        }
      | Array<{ dataset?: { id?: string; code?: string; name?: string } }>;
    version: string;
  };
  createdAt: string;
}

export interface ChatPageContentProps {
  showConversationName?: boolean;
  hideCollectionActions?: boolean;
  withLayout?: boolean;
  forcedCollectionId?: string | null;
  forcedDatasetIds?: string[];
}

export function ChatPageContent({
  showConversationName,
  hideCollectionActions,
  withLayout = true,
  forcedCollectionId,
  forcedDatasetIds,
}: ChatPageContentProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(
    forcedDatasetIds ?? [],
  );
  const api = useApi();
  const [isMounted, setIsMounted] = useState(false);
  const [chatInitialMessages, setChatInitialMessages] = useState<
    ConversationMessage[] | undefined
  >(undefined);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [initialCollectionId, setInitialCollectionId] = useState<string | null>(
    null,
  );
  const params = useParams();
  const searchParams = useSearchParams();
  const isInitializedRef = useRef(false);
  const lastConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (forcedCollectionId !== undefined) {
      setInitialCollectionId(forcedCollectionId);
      return;
    }
    const collectionId = searchParams?.get("collection");
    if (collectionId !== initialCollectionId) {
      setInitialCollectionId(collectionId);
    }
  }, [searchParams, initialCollectionId, forcedCollectionId]);

  useEffect(() => {
    if (!isMounted || !api.hasToken) return;

    const id = params?.conversationId as string | undefined;
    const lastConversationId = sessionStorage.getItem("lastConversationId");
    const isTransitioningFromConversation = lastConversationId !== null && !id;

    if (id && id !== conversationId) {
      sessionStorage.setItem("lastConversationId", id);
      setConversationId(id);
      lastConversationIdRef.current = id;
      isInitializedRef.current = true;

      const fetchHistory = async () => {
        const queryParams =
          "?f=id&f=isActive&f=name&f=user.id&f=user.name&f=datasets.dataset.id&f=datasets.dataset.code&f=messages.kind&f=messages.data&f=messages.createdAt";
        const data = await api.getConversation(id, queryParams);

        let datasetIds: string[] = [];
        if (data.datasets && Array.isArray(data.datasets)) {
          datasetIds = (data.datasets as ConversationDataset[])
            .map((d) => d.dataset?.id)
            .filter((id: string | undefined) => typeof id === "string");
        }

        if (Array.isArray(data.messages)) {
          (data.messages as ConversationMessage[]).forEach((msg) => {
            if (msg.data && Array.isArray(msg.data.payload)) {
              (msg.data.payload as unknown[]).forEach((item) => {
                if (
                  typeof item === "object" &&
                  item !== null &&
                  "dataset" in item &&
                  (item as { dataset?: { id?: string } }).dataset?.id &&
                  !datasetIds.includes(
                    (item as { dataset: { id: string } }).dataset.id,
                  )
                ) {
                  datasetIds.push(
                    (item as { dataset: { id: string } }).dataset.id,
                  );
                }
              });
            }
          });
        }
        setSelectedDatasets(forcedDatasetIds ?? datasetIds);
      };
      fetchHistory();
    } else if (!id && conversationId !== null) {
      setConversationId(null);
      setChatInitialMessages([]);
      lastConversationIdRef.current = null;
      isInitializedRef.current = true;

      if (isTransitioningFromConversation) {
        setSelectedDatasets(forcedDatasetIds ?? []);
        sessionStorage.removeItem("lastConversationId");
      }
    } else if (!id && !isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  }, [isMounted, params, api.hasToken, forcedDatasetIds]);

  useEffect(() => {
    const id = params?.conversationId as string | undefined;
    if (
      (id && id !== lastConversationIdRef.current) ||
      (!id && lastConversationIdRef.current !== null)
    ) {
      isInitializedRef.current = false;
    }
  }, [params?.conversationId]);

  useEffect(() => {
    if (conversationId) return;
    const fetchAllDatasets = async () => {
      if (!api.hasToken) return;
      const data = await api.queryDatasets(API_DATASETS_PAYLOAD);
      if (Array.isArray(data.items)) {
        setDatasets(data.items);
      }
    };
    fetchAllDatasets();
  }, [conversationId, api.hasToken]);

  useEffect(() => {
    const fetchDatasets = async () => {
      if (!conversationId || selectedDatasets.length === 0) return;
      if (!api.hasToken) return;
      const payload = {
        project: {
          fields: [
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
          ],
        },
        ids: selectedDatasets,
        page: { Offset: 0, Size: 100 },
        Order: { Items: ["+code"] },
        Metadata: { CountAll: true },
      };
      const data = await api.queryDatasets(payload);
      if (Array.isArray(data.items)) {
        setDatasets(data.items);
      }
    };
    fetchDatasets();
  }, [conversationId, selectedDatasets, api.hasToken]);

  useEffect(() => {
    if (!conversationId) return;
    setChatInitialMessages(undefined);
    const fetchMessages = async () => {
      if (!api.hasToken) return;
      const payload = {
        project: {
          fields: [
            "id",
            "kind",
            "data",
            "createdAt",
            "conversation.id",
            "conversation.name",
          ],
        },
        conversationIds: [conversationId],
        page: { Offset: 0, Size: 100 },
        Order: { Items: ["+createdAt"] },
        Metadata: { CountAll: true },
      };
      const data = await api.queryMessages(payload);
      if (Array.isArray(data.items)) {
        setChatInitialMessages(data.items);
      } else {
        setChatInitialMessages([]);
      }
    };
    fetchMessages();
  }, [conversationId, api.hasToken]);

  function normalizeDatasets(rawDatasets: unknown[]): unknown[] {
    return rawDatasets.map((d) => {
      if (d && typeof d === "object") {
        const obj = d as Record<string, unknown>;
        if (
          "dataset" in obj &&
          obj.dataset &&
          typeof (obj.dataset as Record<string, unknown>).id === "string"
        ) {
          return { ...obj, id: (obj.dataset as Record<string, unknown>).id };
        }
        if ("id" in obj && typeof obj.id === "string") {
          return obj;
        }
      }
      return d;
    });
  }

  const chat = (
    <Chat
      selectedDatasets={selectedDatasets}
      datasets={normalizeDatasets(datasets) as Dataset[]}
      onSelectedDatasetsChange={(datasets) => {
        setSelectedDatasets(forcedDatasetIds ?? datasets);
      }}
      conversationId={conversationId}
      initialMessages={chatInitialMessages ?? undefined}
      showConversationName={showConversationName}
      hideCollectionActions={hideCollectionActions}
      initialCollectionId={initialCollectionId}
    />
  );

  if (!withLayout) {
    return <ProtectedPage>{chat}</ProtectedPage>;
  }

  return (
    <ProtectedPage>
      <DashboardLayout>{chat}</DashboardLayout>
    </ProtectedPage>
  );
}
