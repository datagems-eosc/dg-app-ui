"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Chat from "@/components/Chat";
import { useParams } from "next/navigation";
import type { Dataset } from "@/data/mockDatasets";
// import { getApiBaseUrl } from "@/lib/utils"; // No longer needed
import ProtectedPage from "@/components/ProtectedPage";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/apiClient";
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

export default function ChatPage({
  showConversationName = true,
  hideCollectionActions = false,
}: ChatPageProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  // Removed unused messages state
  const [chatInitialMessages, setChatInitialMessages] = useState<
    ConversationMessage[]
  >([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const params = useParams();

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load selected datasets from localStorage only after component mounts
  // Only load from localStorage if we're not in a conversation (for initial chat state)
  useEffect(() => {
    if (isMounted && !conversationId) {
      const stored = localStorage.getItem("chatSelectedDatasets");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSelectedDatasets(parsed);
          }
        } catch (error) {
          console.error("Error loading selected datasets:", error);
        }
      }
    }
  }, [isMounted, conversationId]);

  // Save selected datasets to localStorage whenever they change (only when mounted)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(
        "chatSelectedDatasets",
        JSON.stringify(selectedDatasets)
      );
    }
  }, [selectedDatasets, isMounted]);

  // If conversationId is present in the URL, fetch conversation history
  // If conversationId is not present (navigating to initial chat), reset selected datasets
  useEffect(() => {
    const id = params?.conversationId as string | undefined;
    if (id) {
      setConversationId(id);
      const fetchHistory = async () => {
        // next-auth session type does not include accessToken by default
        const token = (session as any)?.accessToken;
        if (!token) return;
        const queryParams =
          "?f=id&f=isActive&f=name&f=user.id&f=user.name&f=datasets.dataset.id&f=datasets.dataset.code&f=messages.kind&f=messages.data&f=messages.createdAt";
        const data = await apiClient.getConversation(id, queryParams, token);
        // Extract selected datasets from datasets field and messages
        let datasetIds: string[] = [];
        if (data.datasets && Array.isArray(data.datasets)) {
          datasetIds = (data.datasets as ConversationDataset[])
            .map((d) => d.dataset?.id)
            .filter((id: string | undefined) => typeof id === "string");
        }
        // Also scan messages for datasets
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
                    (item as { dataset: { id: string } }).dataset.id
                  )
                ) {
                  datasetIds.push(
                    (item as { dataset: { id: string } }).dataset.id
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
      // No conversationId means we're on the initial chat page - reset selected datasets
      setConversationId(null);
      setSelectedDatasets([]);
      setChatInitialMessages([]);
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [params, session]);

  // Fetch all datasets from API if not in a conversation
  useEffect(() => {
    if (conversationId) return;
    const fetchAllDatasets = async () => {
      // next-auth session type does not include accessToken by default
      const token = (session as any)?.accessToken;
      if (!token) return;
      const data = await apiClient.queryDatasets(API_DATASETS_PAYLOAD, token);
      if (Array.isArray(data.items)) {
        setDatasets(data.items);
      }
    };
    fetchAllDatasets();
  }, [conversationId, session]);

  // Fetch detailed dataset info when selectedDatasets changes and conversationId is present
  useEffect(() => {
    const fetchDatasets = async () => {
      if (!conversationId || selectedDatasets.length === 0) return;
      // next-auth session type does not include accessToken by default
      const token = (session as any)?.accessToken;
      if (!token) return;
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
      const data = await apiClient.queryDatasets(payload, token);
      if (Array.isArray(data.items)) {
        setDatasets(data.items);
      }
    };
    fetchDatasets();
  }, [conversationId, selectedDatasets, session]);

  // Fetch conversation messages when on /chat/[conversationId]
  useEffect(() => {
    if (!conversationId) return;
    setChatInitialMessages(undefined);
    const fetchMessages = async () => {
      // next-auth session type does not include accessToken by default
      const token = (session as any)?.accessToken;
      if (!token) return;
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
      const data = await apiClient.queryMessages(payload, token);
      if (Array.isArray(data.items)) {
        setChatInitialMessages(data.items);
      } else {
        setChatInitialMessages([]);
      }
    };
    fetchMessages();
  }, [conversationId, session]);

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
          onSelectedDatasetsChange={setSelectedDatasets}
          conversationId={conversationId}
          initialMessages={chatInitialMessages ?? undefined}
          showConversationName={showConversationName}
          hideCollectionActions={hideCollectionActions}
        />
      </DashboardLayout>
    </ProtectedPage>
  );
}
