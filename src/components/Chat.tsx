"use client";

import React, { useState, useEffect } from "react";
import { Database, FileText } from "lucide-react";
import { ChatInput } from "./ui/chat/ChatInput";
import { useRouter } from "next/navigation";
import { Dataset } from "@/data/mockDatasets";
import SelectedDatasetsPanel from "./SelectedDatasetsPanel";
import AddDatasetsModal from "./AddDatasetsModal";
import { Button } from "./ui/Button";
import type { ConversationMessage } from "@/app/chat/page";
import { useSession } from "next-auth/react";
import ChatInitialView from "./ui/chat/ChatInitialView";
import ChatMessages from "./ui/chat/ChatMessages";
import DatasetChangeWarning from "./ui/chat/DatasetChangeWarning";
import { useCollections } from "@/contexts/CollectionsContext";
import { Collection } from "@/types/collection";
import { getLogoutUrl, getNavigationUrl } from "@/lib/utils";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date | string;
  sources?: number;
  relatedDatasetIds?: string[];
  datasetIds?: string[]; // Add this field for user messages with datasetIds
  tableData?: {
    columns: Array<{ columnNumber: number; name: string }>;
    rows: Array<{
      rowNumber: number;
      cells: Array<{ column: string; value: string | number }>;
    }>;
  };
}

interface ChatProps {
  selectedDatasets: string[];
  datasets: Dataset[];
  onSelectedDatasetsChange: (selected: string[]) => void;
  conversationId?: string | null;
  initialMessages?: ConversationMessage[];
  showConversationName?: boolean;
  hideCollectionActions?: boolean;
}

// Add type for cross-dataset search result
interface CrossDatasetSearchResult {
  dataset: {
    id: string;
    code: string;
    name: string;
  };
}

interface DatasetPayloadItem {
  dataset?: { id?: string; code?: string; name?: string };
}

type MessageType = "user" | "ai";

export default function Chat({
  selectedDatasets,
  datasets,
  onSelectedDatasetsChange,
  conversationId,
  initialMessages,
  showConversationName = true,
  hideCollectionActions = false,
}: ChatProps) {
  // Store only Message[] for UI rendering
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [isGeneratingAIResponse, setIsGeneratingAIResponse] = useState(false);

  // Collections state
  const { collections, apiCollections, isLoadingApiCollections } =
    useCollections();
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);

  // Add state for tracking previous datasets to detect changes
  const [previousDatasets, setPreviousDatasets] = useState<string[]>([]);
  const [showDatasetChangeWarning, setShowDatasetChangeWarning] =
    useState(false);

  // Add flag to track manual collection selection
  const [isManualCollectionSelection, setIsManualCollectionSelection] =
    useState(false);

  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);

  // State for sources panel
  const [messageRelatedDatasets, setMessageRelatedDatasets] = useState<
    string[]
  >([]);
  const [isSourcesPanel, setIsSourcesPanel] = useState(false);

  // Sync messages with initialMessages when it changes
  useEffect(() => {
    setIsMessagesLoading(true);
    if (initialMessages && initialMessages.length > 0) {
      const parsed = initialMessages
        .filter((msg) => msg.kind >= 0 && msg.kind <= 3)
        .map((msg, idx) => {
          let content = "";
          let tableData: Message["tableData"] | undefined;

          if (msg.kind === 0) {
            // User message (old format) - extract query
            const payload = msg.data?.payload;
            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload) &&
              "query" in payload
            ) {
              content = (payload as { query?: string }).query || "";
            } else {
              content = "";
            }
          } else if (msg.kind === 1) {
            // AI message (old format) - extract dataset names from payload array
            let relatedDatasetIds: string[] = [];
            if (Array.isArray(msg.data?.payload)) {
              const names = (msg.data.payload as DatasetPayloadItem[])
                .map((item) => item.dataset?.name)
                .filter((n: string | undefined) => typeof n === "string");

              // Extract dataset IDs
              relatedDatasetIds = (msg.data.payload as DatasetPayloadItem[])
                .map((item) => item.dataset?.id)
                .filter(
                  (id: string | undefined) => typeof id === "string"
                ) as string[];

              if (names.length > 0) {
                if (names.length === 1) {
                  content = `Given your question, the following dataset might be useful: ${names[0]}`;
                } else {
                  content = `Given your question, the following datasets might be useful:\n\n${names
                    .map((n) => `• ${n}`)
                    .join("\n")}`;
                }
              } else {
                content =
                  "Given your question, some datasets might be useful, but no names were found.";
              }
            } else {
              content =
                typeof msg.data?.payload === "string"
                  ? msg.data.payload
                  : JSON.stringify(msg.data?.payload);
            }

            return {
              id: msg.id || getMessageId(msg, idx),
              type: "ai" as MessageType,
              content,
              timestamp: msg.createdAt,
              tableData,
              sources: relatedDatasetIds.length,
              relatedDatasetIds,
            };
          } else if (msg.kind === 2) {
            // User message (new format) - extract question and datasetIds
            const payload = msg.data?.payload;
            let userDatasetIds: string[] = [];
            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload) &&
              "question" in payload
            ) {
              content = (payload as { question?: string }).question || "";
              // Extract datasetIds if present
              if (
                "datasetIds" in payload &&
                Array.isArray(payload.datasetIds)
              ) {
                userDatasetIds = (payload.datasetIds as unknown[]).filter(
                  (id) => typeof id === "string"
                ) as string[];
              }
            } else {
              content = "";
            }

            return {
              id: msg.id || getMessageId(msg, idx),
              type: "user" as MessageType,
              content,
              timestamp: msg.createdAt,
              datasetIds: userDatasetIds,
            };
          } else if (msg.kind === 3) {
            // AI message (new format) - extract table data if available
            const payload = msg.data?.payload;
            const relatedDatasetIds: string[] = [];
            let latitude: number | undefined;
            let longitude: number | undefined;

            // Extract coordinates from InputParams if available
            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload) &&
              "data" in payload &&
              payload.data &&
              typeof payload.data === "object" &&
              "InputParams" in payload.data &&
              Array.isArray(payload.data.InputParams)
            ) {
              const inputParams = payload.data.InputParams;
              // Look for the first InputParam with lat/lon values
              for (const param of inputParams) {
                if (
                  param &&
                  typeof param === "object" &&
                  "lat" in param &&
                  "lon" in param
                ) {
                  latitude =
                    typeof param.lat === "number" ? param.lat : undefined;
                  longitude =
                    typeof param.lon === "number" ? param.lon : undefined;
                  break;
                }
              }
            }

            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload) &&
              "entries" in payload
            ) {
              const entries = (
                payload as { entries?: Array<{ result?: { table?: any } }> }
              ).entries;
              if (entries && entries.length > 0 && entries[0].result?.table) {
                tableData = entries[0].result.table;
                // Create a simple text representation of the table data
                const table = entries[0].result.table;
                if (table.columns && table.rows) {
                  const columnNames = table.columns
                    .map((col) => col.name)
                    .join(" | ");
                  const rowData = table.rows
                    .map((row) =>
                      row.cells.map((cell) => cell.value).join(" | ")
                    )
                    .join("\n");
                  content = `Table Results:\n`;
                } else {
                  content = "Data analysis completed.";
                }
              } else {
                content = "Analysis completed.";
              }
            } else {
              content = "Analysis completed.";
            }

            return {
              id: msg.id || getMessageId(msg, idx),
              type: "ai" as MessageType,
              content,
              timestamp: msg.createdAt,
              tableData,
              sources: relatedDatasetIds.length,
              relatedDatasetIds,
              latitude,
              longitude,
            };
          }

          // Handle user messages (kind 0 and 2)
          return {
            id: msg.id || getMessageId(msg, idx),
            type: (msg.kind % 2 === 0 ? "user" : "ai") as MessageType,
            content,
            timestamp: msg.createdAt,
            tableData,
          };
        });
      setMessages(parsed);
    } else {
      setMessages([]);
    }
    setIsMessagesLoading(false);
  }, [initialMessages]);
  const [inputValue, setInputValue] = useState("");
  const [showAddDatasetsModal, setShowAddDatasetsModal] = useState(false);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatasetNamesMap, setSelectedDatasetNamesMap] = useState<
    Record<string, string>
  >({});
  const router = useRouter();
  const { data: session } = useSession();

  // Automatically show sidebar when datasets are selected (only for new conversations)
  useEffect(() => {
    // Don't auto-show panel when opening an existing conversation
    if (!conversationId) {
      setShowSelectedPanel(selectedDatasets.length > 0);
    }
  }, [selectedDatasets.length, conversationId]);

  // Add effect to detect collection from messages and set it automatically
  useEffect(() => {
    // Skip automatic collection detection during manual collection selection
    if (isManualCollectionSelection) {
      return;
    }

    if (
      messages.length > 0 &&
      apiCollections.length > 0 &&
      collections.length >= 0
    ) {
      // Find the last message with dataset information (either AI with relatedDatasetIds or user with datasetIds)
      const lastMessageWithDatasets = [...messages].reverse().find((msg) => {
        const hasAIDatasets =
          msg.type === "ai" &&
          msg.relatedDatasetIds &&
          msg.relatedDatasetIds.length > 0;
        const hasUserDatasets =
          msg.type === "user" && msg.datasetIds && msg.datasetIds.length > 0;

        return hasAIDatasets || hasUserDatasets;
      });

      if (lastMessageWithDatasets) {
        // Get dataset IDs from either relatedDatasetIds (AI) or datasetIds (user)
        const messageDatasetIds =
          lastMessageWithDatasets.type === "ai"
            ? lastMessageWithDatasets.relatedDatasetIds
            : lastMessageWithDatasets.datasetIds;

        if (messageDatasetIds && messageDatasetIds.length > 0) {
          // Only update selected datasets if they don't match message datasets AND we're not in an existing conversation
          // In existing conversations, preserve user's dataset selection
          if (
            !conversationId &&
            !arraysEqual(selectedDatasets, messageDatasetIds)
          ) {
            onSelectedDatasetsChange(messageDatasetIds);
          }

          // Try to find a matching collection
          const allCollections = [...apiCollections, ...collections];
          const matchingCollection = allCollections.find((collection) => {
            let collectionDatasetIds: string[] = [];

            // Handle API collections with datasets array
            if (
              "datasets" in collection &&
              collection.datasets &&
              collection.datasets.length > 0
            ) {
              collectionDatasetIds = collection.datasets.map(
                (dataset) => dataset.id
              );
            }
            // Handle user collections with datasetIds array
            else if (
              collection.datasetIds &&
              collection.datasetIds.length > 0
            ) {
              collectionDatasetIds = collection.datasetIds;
            }

            // Check if the current selected datasets match this collection exactly
            if (
              collectionDatasetIds.length === selectedDatasets.length &&
              collectionDatasetIds.length > 0
            ) {
              const allMatch = selectedDatasets.every((id) =>
                collectionDatasetIds.includes(id)
              );
              return allMatch;
            }
            return false;
          });

          // Only auto-set collection if none is currently selected
          if (matchingCollection && !selectedCollection) {
            setSelectedCollection(matchingCollection);
          } else if (
            !matchingCollection &&
            selectedCollection &&
            !conversationId
          ) {
            // Only show warning for new conversations when collection doesn't match
            setShowDatasetChangeWarning(true);
          }
        }
      }
    }
  }, [
    messages,
    apiCollections,
    collections,
    selectedDatasets,
    conversationId,
    isManualCollectionSelection,
  ]);

  // Add effect to detect dataset changes and show warning
  useEffect(() => {
    if (messages.length > 0 && previousDatasets.length > 0) {
      const hasChanged = !arraysEqual(selectedDatasets, previousDatasets);

      // Only show warning if:
      // 1. Datasets actually changed
      // 2. We're in an existing conversation (conversationId exists)
      // 3. There are messages that would be affected by the change
      if (hasChanged && conversationId && messages.length > 0) {
        setShowDatasetChangeWarning(true);
      }
    }
  }, [selectedDatasets, previousDatasets, messages.length, conversationId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    setError(null);
    setIsLoading(true);

    // Store current datasets as previous before sending
    setPreviousDatasets([...selectedDatasets]);
    // Clear any dataset change warning since user is proceeding
    setShowDatasetChangeWarning(false);

    try {
      let newSelectedDatasets = selectedDatasets;
      let foundDatasetNames: string[] | null = null;

      // For existing conversations, use the in-data-explore API directly
      if (conversationId && selectedDatasets.length > 0) {
        const token = (session as any)?.accessToken;
        if (!token) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }

        const payload = {
          conversationOptions: {
            conversationId: conversationId,
            autoCreateConversation: false,
          },
          project: {
            fields: ["question", "data", "status", "entries"],
          },
          query: inputValue,
          resultCount: 100,
          datasetIds: selectedDatasets,
        };

        const response = await fetch("/api/search/in-data-explore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          window.location.href = "/logout";
          return;
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch data");
        }

        // Add user message immediately
        const userMessage: Message = {
          id: Date.now().toString(),
          type: "user",
          content: inputValue,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Show skeleton while generating AI response
        setIsGeneratingAIResponse(true);

        // Simulate AI response after a short delay
        setTimeout(() => {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: `I've analyzed your question "${inputValue}" using the selected datasets. Here's what I found...`,
            timestamp: new Date(),
            sources: selectedDatasets.length,
            relatedDatasetIds: selectedDatasets,
          };
          setMessages((prev) => [...prev, aiResponse]);
          setIsGeneratingAIResponse(false);
        }, 2000);

        setInputValue("");
        setIsLoading(false);
        return;
      }

      // If no datasets are selected, call persist first, then cross-dataset search API
      if (selectedDatasets.length === 0) {
        // next-auth session type does not include accessToken by default
        const token = (session as any)?.accessToken;
        if (!token) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }
        // Step 1: Create conversation
        const persistPayload = {
          name: inputValue,
        };
        const persistResponse = await fetch(
          "/api/conversation/me/persist?f=id&f=etag",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(persistPayload),
          }
        );
        if (persistResponse.status === 401) {
          window.location.href = getLogoutUrl();
          return;
        }
        if (!persistResponse.ok) {
          const errorData = await persistResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create conversation");
        }
        const persistData = await persistResponse.json();
        const conversationIdFromPersist = persistData.id;
        if (!conversationIdFromPersist) {
          setError("No conversation ID returned from server.");
          setIsLoading(false);
          return;
        }
        // Step 2: Call cross-dataset search with conversationId
        const payload = {
          conversationOptions: {
            conversationId: conversationIdFromPersist,
            autoCreateConversation: false,
          },
          project: {
            fields: [
              "conversationId",
              "content",
              "useCase",
              "dataset.id",
              "dataset.code",
              "dataset.name",
              "sourceId",
              "chunkId",
              "language",
              "distance",
            ],
          },
          query: inputValue,
          resultCount: 100,
        };
        const response = await fetch("/api/search/cross-dataset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (response.status === 401) {
          window.location.href = getLogoutUrl();
          return;
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch datasets");
        }
        const data = await response.json();
        if (Array.isArray(data.result)) {
          const results = data.result as CrossDatasetSearchResult[];
          newSelectedDatasets = results
            .map((item) => item.dataset?.id)
            .filter((id: string | undefined) => typeof id === "string");
          foundDatasetNames = results
            .map((item) => item.dataset?.name)
            .filter((name: string | undefined) => typeof name === "string");
          // Build a map of id -> name for sidebar fallback
          const namesMap: Record<string, string> = {};
          results.forEach((item) => {
            if (item.dataset?.id && item.dataset?.name) {
              namesMap[item.dataset.id] = item.dataset.name;
            }
          });
          setSelectedDatasetNamesMap(namesMap);
          onSelectedDatasetsChange(newSelectedDatasets);
          // Also update localStorage for consistency
          localStorage.setItem(
            "chatSelectedDatasets",
            JSON.stringify(newSelectedDatasets)
          );
          // Redirect to /chat/conversationId if present in response and not already in a conversation
          if (conversationIdFromPersist && !conversationId) {
            router.push(getNavigationUrl(`/chat/${conversationIdFromPersist}`));
          }
        } else {
          setError("No datasets found for your query.");
          setIsLoading(false);
          return;
        }
      } else if (!conversationId) {
        // If datasets are selected and not already in a conversation, create a new conversation and then search
        // next-auth session type does not include accessToken by default
        const token = (session as any)?.accessToken;
        if (!token) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }
        // Step 1: Create conversation with datasets
        const persistPayload = {
          name: inputValue,
          conversationDatasets: selectedDatasets.map((id) => ({
            datasetId: id,
          })),
        };
        const persistResponse = await fetch(
          "/api/conversation/me/persist/deep?f=id&f=etag",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(persistPayload),
          }
        );
        if (persistResponse.status === 401) {
          window.location.href = getLogoutUrl();
          return;
        }
        if (!persistResponse.ok) {
          const errorData = await persistResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create conversation");
        }
        const persistData = await persistResponse.json();
        const conversationIdFromPersist = persistData.id;
        if (!conversationIdFromPersist) {
          setError("No conversation ID returned from server.");
          setIsLoading(false);
          return;
        }
        // Step 2: Call in-data-explore search with conversationId
        const payload = {
          conversationOptions: {
            conversationId: conversationIdFromPersist,
            autoCreateConversation: false,
          },
          project: {
            fields: ["question", "data", "status", "entries"],
          },
          query: inputValue,
          resultCount: 100,
          datasetIds: selectedDatasets, // Add datasetIds for in-data-explore
        };
        const response = await fetch("/api/search/in-data-explore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (response.status === 401) {
          window.location.href = getLogoutUrl();
          return;
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch datasets");
        }
        const data = await response.json();
        let newSelectedDatasets = selectedDatasets;
        if (response.status === 200) {
          // Redirect to chat details page with conversationId
          if (conversationIdFromPersist) {
            router.push(getNavigationUrl(`/chat/${conversationIdFromPersist}`));
            return; // Prevent further state updates after redirect
          }
        }
        if (Array.isArray(data.result)) {
          const results = data.result as CrossDatasetSearchResult[];
          newSelectedDatasets = results
            .map((item) => item.dataset?.id)
            .filter((id: string | undefined) => typeof id === "string");
          foundDatasetNames = results
            .map((item) => item.dataset?.name)
            .filter((name: string | undefined) => typeof name === "string");
          // Build a map of id -> name for sidebar fallback
          const namesMap: Record<string, string> = {};
          results.forEach((item) => {
            if (item.dataset?.id && item.dataset?.name) {
              namesMap[item.dataset.id] = item.dataset.name;
            }
          });
          setSelectedDatasetNamesMap(namesMap);
          onSelectedDatasetsChange(newSelectedDatasets);
          // Also update localStorage for consistency
          localStorage.setItem(
            "chatSelectedDatasets",
            JSON.stringify(newSelectedDatasets)
          );
          // Redirect to /chat/conversationId if present in response and not already in a conversation
          if (conversationIdFromPersist && !conversationId) {
            router.push(getNavigationUrl(`/chat/${conversationIdFromPersist}`));
          }
        } else {
          setError("No datasets found for your query.");
          setIsLoading(false);
          return;
        }
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: inputValue,
        timestamp: new Date(),
      };
      setMessages([userMessage]);
      // If datasets were found via cross-dataset search, show a system message
      if (foundDatasetNames && foundDatasetNames.length > 0) {
        // Also update the names map for sidebar fallback
        const namesMap: Record<string, string> = {};
        newSelectedDatasets.forEach((id, idx) => {
          if (foundDatasetNames && foundDatasetNames[idx]) {
            namesMap[id] = foundDatasetNames[idx];
          }
        });
        setSelectedDatasetNamesMap(namesMap);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: `Based on your query we found the following datasets: ${foundDatasetNames.join(
              ", "
            )}`,
            timestamp: new Date(),
            sources: foundDatasetNames.length,
          },
        ]);
      }
      // Show skeleton while generating AI response
      setIsGeneratingAIResponse(true);

      // Simulate AI response after a short delay
      setTimeout(() => {
        const aiResponse = generateAIResponse(
          inputValue,
          newSelectedDatasets,
          datasets,
          foundDatasetNames
        );
        setMessages((prev) => [...prev, aiResponse]);
        setIsGeneratingAIResponse(false);
      }, 1000);
      setInputValue("");
    } catch (err: unknown) {
      let message = "An unexpected error occurred";
      if (err instanceof Error) message = err.message;
      else if (typeof err === "string") message = err;
      setError(message);
    } finally {
      setIsLoading(false);
      setIsGeneratingAIResponse(false);
    }
  };

  const generateAIResponse = (
    question: string,
    datasetIds: string[],
    allDatasets: Dataset[],
    foundDatasetNames?: string[] | null
  ): Message => {
    if (foundDatasetNames && foundDatasetNames.length > 0) {
      return {
        id: (Date.now() + 2).toString(),
        type: "ai",
        content: `You can now ask questions about these datasets: ${foundDatasetNames.join(
          ", "
        )}`,
        timestamp: new Date(),
        sources: foundDatasetNames.length,
        relatedDatasetIds: datasetIds,
      };
    }
    const selectedDatasetList = allDatasets.filter((d) =>
      datasetIds.includes(d.id)
    );

    // Default response
    return {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: `Based on the ${
        selectedDatasetList.length
      } dataset(s) you've selected (${selectedDatasetList
        .map((d) => d.title)
        .join(
          ", "
        )}), I can help you analyze your question: "${question}". However, I need more specific information to provide a detailed answer. Could you please clarify what specific aspects you'd like me to focus on?`,
      timestamp: new Date(),
      sources: selectedDatasetList.length,
      relatedDatasetIds: datasetIds,
    };
  };

  const handleBackToBrowse = () => {
    router.push(getNavigationUrl("/browse"));
  };

  const toggleSidebar = () => {
    // Panel animation
    if (!showSelectedPanel) {
      setShowSelectedPanel(true);
      setIsSourcesPanel(false); // Reset to regular selected datasets panel
      // Start panel off-screen, then animate in
      setIsPanelAnimating(true);
      setTimeout(() => setIsPanelAnimating(false), 50);
    } else {
      // Animate panel closing
      setIsPanelClosing(true);
      setTimeout(() => {
        setShowSelectedPanel(false);
        setIsPanelClosing(false);
        setIsSourcesPanel(false);
      }, 500); // Match the CSS transition duration
    }
  };

  const handleSelectCollection = (collection: Collection | null) => {
    // Set flag to prevent automatic collection detection during manual selection
    setIsManualCollectionSelection(true);

    // Store current datasets as previous before changing them
    setPreviousDatasets([...selectedDatasets]);

    setSelectedCollection(collection);

    // If a collection is selected, get all dataset IDs from it and update selected datasets
    if (collection) {
      let datasetIds: string[] = [];

      // Check if collection has datasets array (API collections)
      if (
        "datasets" in collection &&
        collection.datasets &&
        collection.datasets.length > 0
      ) {
        datasetIds = collection.datasets.map((dataset) => dataset.id);
      }
      // Check if collection has datasetIds array (user collections)
      else if (collection.datasetIds && collection.datasetIds.length > 0) {
        datasetIds = collection.datasetIds;
      }

      // Update selected datasets with collection datasets
      if (datasetIds.length > 0) {
        onSelectedDatasetsChange(datasetIds);

        // Build names map for the selected datasets
        const namesMap: Record<string, string> = {};
        datasetIds.forEach((id) => {
          const dataset = datasets.find((d) => d.id === id);
          if (dataset) {
            namesMap[id] = dataset.title;
          } else {
            // Fallback: use collection name if dataset not found
            namesMap[id] = `${collection.name} Dataset`;
          }
        });
        setSelectedDatasetNamesMap(namesMap);

        // Update localStorage for consistency
        localStorage.setItem(
          "chatSelectedDatasets",
          JSON.stringify(datasetIds)
        );

        // Show the selected datasets panel
        setShowSelectedPanel(true);
        setIsSourcesPanel(false);
        setIsPanelAnimating(true);
        setTimeout(() => setIsPanelAnimating(false), 50);
      }
    } else {
      // If no collection is selected, clear selected datasets
      onSelectedDatasetsChange([]);
      setSelectedDatasetNamesMap({});
      setShowSelectedPanel(false);

      // Clear localStorage
      localStorage.removeItem("chatSelectedDatasets");
    }

    // Reset the manual selection flag after a brief delay to allow the dataset change to process
    setTimeout(() => {
      setIsManualCollectionSelection(false);
    }, 100);
  };

  const handleClosePanel = () => {
    // Animate panel closing
    setIsPanelClosing(true);
    setTimeout(() => {
      setShowSelectedPanel(false);
      setIsPanelClosing(false);
      setIsSourcesPanel(false);
    }, 500); // Match the CSS transition duration
  };

  // Handler for sources button click
  const handleSourcesClick = (messageId: string) => {
    // Find the message and extract related datasets
    const message = messages.find((m) => m.id === messageId);
    if (message && message.sources && message.relatedDatasetIds) {
      setMessageRelatedDatasets(message.relatedDatasetIds);
      setIsSourcesPanel(true);
      setShowSelectedPanel(true);
      // Start panel off-screen, then animate in
      setIsPanelAnimating(true);
      setTimeout(() => setIsPanelAnimating(false), 50);
    }
  };

  // Helper: Only disable input when loading or generating AI response
  const isInputDisabled = isLoading || isGeneratingAIResponse;

  // Add scroll-to-bottom for messages
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // Scroll-to-bottom removed as per request

  return (
    <div
      className={`flex relative h-full transition-all duration-500 ease-in-out ${messages.length > 0 ? "h-full" : ""}`}
    >
      {/* Main Chat Area */}
      <div
        className="flex-1 flex flex-col transition-all duration-500 ease-in-out min-h-0 max-w-4xl mx-auto"
        style={{
          position: "relative",
          ...(messages.length > 0 ? { minHeight: "100vh" } : {}),
        }}
      >
        {/* Header */}
        <div className="bg-white flex-shrink-0 py-6">
          {/* Conversation Name (first user message) */}
          {showConversationName &&
            conversationId &&
            messages.length > 0 &&
            messages[0].type === "user" && (
              <div className="text-center py-4 px-6 border-b border-gray-100">
                <h2 className="text-H2-20-semibold text-blue-700 truncate">
                  {messages[0].content}
                </h2>
              </div>
            )}
          <div className="flex items-center justify-end p-4 h-10">
            {/* Sidebar toggle button */}
            {!showSelectedPanel && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSidebar}
                className="flex items-center gap-2 transition-all duration-200"
              >
                <Database className="w-4 h-4 text-icon" />
                {selectedDatasets.length} Selected
              </Button>
            )}
          </div>

          {messages.length === 0 && <ChatInitialView />}
        </div>

        {/* Messages Area - Only show when messages exist or loading */}
        {(messages.length > 0 || isMessagesLoading) && (
          <>
            <div
              className="flex-1 bg-white overflow-y-auto min-h-0"
              ref={messagesEndRef}
            >
              <ChatMessages
                messages={messages}
                isMessagesLoading={isMessagesLoading}
                isGeneratingAIResponse={isGeneratingAIResponse}
                messagesEndRef={messagesEndRef}
                onSourcesClick={handleSourcesClick}
              />
            </div>

            {/* Chat Input - Positioned right after messages */}
            <div className="px-6 py-4 bg-white">
              <div className="w-full max-w-4xl mx-auto">
                {/* Dataset Change Warning */}
                <DatasetChangeWarning isVisible={showDatasetChangeWarning} />

                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSendMessage}
                  onAddDatasets={() => setShowAddDatasetsModal(true)}
                  collections={{
                    apiCollections,
                    collections,
                    isLoading: isLoadingApiCollections,
                  }}
                  selectedCollection={selectedCollection}
                  onSelectCollection={handleSelectCollection}
                  isLoading={isLoading}
                  disabled={isInputDisabled}
                  error={error}
                  showAddDatasetsModal={showAddDatasetsModal}
                />
              </div>
            </div>
          </>
        )}

        {/* Chat Input - Show when no messages exist */}
        {messages.length === 0 && !isMessagesLoading && (
          <div className="relative px-6 py-4">
            <div className="w-full max-w-4xl mx-auto">
              {/* Dataset Change Warning */}
              <DatasetChangeWarning isVisible={showDatasetChangeWarning} />

              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                onAddDatasets={() => setShowAddDatasetsModal(true)}
                collections={{
                  apiCollections,
                  collections,
                  isLoading: isLoadingApiCollections,
                }}
                selectedCollection={selectedCollection}
                onSelectCollection={handleSelectCollection}
                isLoading={isLoading}
                disabled={isInputDisabled}
                error={error}
                showAddDatasetsModal={showAddDatasetsModal}
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected Datasets Panel - Show automatically when datasets selected */}
      {(showSelectedPanel || isPanelClosing) && (
        <div className="h-full z-40 w-full sm:w-[380px]">
          <div
            className={`h-full transition-transform duration-500 ease-out ${
              isPanelAnimating
                ? "translate-x-full"
                : isPanelClosing
                  ? "translate-x-full"
                  : "translate-x-0"
            }`}
          >
            <SelectedDatasetsPanel
              selectedDatasetIds={
                isSourcesPanel ? messageRelatedDatasets : selectedDatasets
              }
              datasets={datasets}
              onRemoveDataset={(id) => {
                const newSelectedDatasets = selectedDatasets.filter(
                  (datasetId) => datasetId !== id
                );
                onSelectedDatasetsChange(newSelectedDatasets);

                // If all datasets are removed and a collection was selected, clear the collection
                if (newSelectedDatasets.length === 0 && selectedCollection) {
                  setSelectedCollection(null);
                }
              }}
              onAddToCollection={() => setShowAddDatasetsModal(true)}
              onClose={handleClosePanel}
              selectedDatasetNamesMap={selectedDatasetNamesMap}
              hideAddToCollection={true}
              hideRemoveDataset={hideCollectionActions}
              customHeaderTitle={
                isSourcesPanel
                  ? `Sources (${messageRelatedDatasets.length})`
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Add Datasets Modal */}
      <AddDatasetsModal
        isVisible={showAddDatasetsModal}
        onClose={() => setShowAddDatasetsModal(false)}
        datasets={datasets}
        onSelectedDatasetsChange={onSelectedDatasetsChange}
      />
    </div>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, index) => val === sortedB[index]);
}

function getMessageId(msg: unknown, idx: number): string {
  if (
    msg &&
    typeof msg === "object" &&
    "id" in msg &&
    typeof (msg as { id?: unknown }).id === "string"
  ) {
    return (msg as { id: string }).id;
  }
  return String(idx);
}
