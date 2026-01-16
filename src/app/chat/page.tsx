"use client";

import { useParams, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import Chat from "@/components/Chat";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedPage from "@/components/ProtectedPage";
import type { Dataset } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";

// API fetch payload (copied from dashboard)
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
  page: {
    Offset: 0,
    Size: 100,
  },
  Order: {
    Items: ["-code"],
  },
  Metadata: {
    CountAll: true,
  },
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
  conversation?: {
    id: string;
  };
  kind: number;
  data: {
    kind: number;
    payload:
      | {
          query?: string; // Old format (kind 0)
          question?: string; // New format (kind 2)
          entries?: Array<{
            result?: {
              table?: {
                columns: Array<{
                  columnNumber: number;
                  name: string;
                }>;
                rows: Array<{
                  rowNumber: number;
                  cells: Array<{
                    column: string;
                    value: string | number;
                  }>;
                }>;
              };
            };
          }>;
        }
      | Array<{
          dataset?: {
            id?: string;
            code?: string;
            name?: string;
          };
        }>; // Old format (kind 1) - array of dataset items
    version: string;
  };
  createdAt: string;
}

interface ChatPageProps {
  showConversationName?: boolean;
  hideCollectionActions?: boolean;
}

// Main chat component that uses useSearchParams
function ChatPageContent({
  showConversationName,
  hideCollectionActions,
}: ChatPageProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
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
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const collectionId = searchParams?.get("collection");
    if (collectionId !== initialCollectionId) {
      setInitialCollectionId(collectionId);
    }
  }, [searchParams, initialCollectionId]);

  useEffect(() => {
    if (!isMounted || hasInitializedRef.current) return;

    const id = params?.conversationId as string | undefined;
    const lastConversationId = sessionStorage.getItem("lastConversationId");
    const isTransitioningFromConversation = lastConversationId !== null && !id;

    if (id) {
      sessionStorage.setItem("lastConversationId", id);
      setConversationId(id);
      hasInitializedRef.current = true;

      const fetchHistory = async () => {
        if (!api.hasToken) return;
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
        setSelectedDatasets(datasetIds);
      };
      fetchHistory();
    } else {
      setConversationId(null);
      setChatInitialMessages([]);
      hasInitializedRef.current = true;

      if (isTransitioningFromConversation) {
        localStorage.removeItem("chatSelectedDatasets");
        setSelectedDatasets([]);
        sessionStorage.removeItem("lastConversationId");
      } else {
        const stored = localStorage.getItem("chatSelectedDatasets");
        if (stored && stored !== "[]") {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedDatasets(parsed);
            }
          } catch (error) {
            logError(
              "Error loading selected datasets from localStorage",
              error,
            );
          }
        }
      }
    }
  }, [isMounted, params, api.hasToken]);

  useEffect(() => {
    const id = params?.conversationId as string | undefined;
    if ((id && id !== conversationId) || (!id && conversationId !== null)) {
      hasInitializedRef.current = false;
    }
  }, [params?.conversationId, conversationId]);

  // Fetch all datasets from API if not in a conversation
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

  // Fetch detailed dataset info when selectedDatasets changes and conversationId is present
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
        page: {
          Offset: 0,
          Size: 100,
        },
        Order: {
          Items: ["+code"],
        },
        Metadata: {
          CountAll: true,
        },
      };
      const data = await api.queryDatasets(payload);
      if (Array.isArray(data.items)) {
        setDatasets(data.items);
      }
    };
    fetchDatasets();
  }, [conversationId, selectedDatasets, api.hasToken]);

  // Fetch conversation messages when on /chat/[conversationId]
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

  // Helper to normalize datasets to always have the correct id (UUID)
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

  return (
    <ProtectedPage>
      <DashboardLayout>
        <Chat
          selectedDatasets={selectedDatasets}
          datasets={normalizeDatasets(datasets) as Dataset[]}
          onSelectedDatasetsChange={(datasets) => {
            setSelectedDatasets(datasets);
            localStorage.setItem(
              "chatSelectedDatasets",
              JSON.stringify(datasets),
            );
          }}
          conversationId={conversationId}
          initialMessages={chatInitialMessages ?? undefined}
          showConversationName={showConversationName}
          hideCollectionActions={hideCollectionActions}
          initialCollectionId={initialCollectionId}
        />
      </DashboardLayout>
    </ProtectedPage>
  );
}

export default function ChatPage({
  showConversationName = true,
  hideCollectionActions = false,
}: ChatPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent
        showConversationName={showConversationName}
        hideCollectionActions={hideCollectionActions}
      />
    </Suspense>
  );
}
