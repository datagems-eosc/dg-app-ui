import type { ConversationMessage } from "@/app/chat/page";
import type { Message } from "@/types/chat";

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

interface DatasetPayloadItem {
  dataset?: { id?: string; code?: string; name?: string };
}

type MessageType = "user" | "ai";

export function parseConversationMessage(
  msg: ConversationMessage,
  idx: number,
): Message {
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

      relatedDatasetIds = (msg.data.payload as DatasetPayloadItem[])
        .map((item) => item.dataset?.id)
        .filter((id: string | undefined) => typeof id === "string") as string[];

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
      if ("datasetIds" in payload && Array.isArray(payload.datasetIds)) {
        userDatasetIds = (payload.datasetIds as unknown[]).filter(
          (id) => typeof id === "string",
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
      for (const param of inputParams) {
        if (
          param &&
          typeof param === "object" &&
          "lat" in param &&
          "lon" in param
        ) {
          latitude = typeof param.lat === "number" ? param.lat : undefined;
          longitude = typeof param.lon === "number" ? param.lon : undefined;
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
        const table = entries[0].result.table;
        if (table.columns && table.rows) {
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

  return {
    id: msg.id || getMessageId(msg, idx),
    type: ((msg as any)?.kind % 2 === 0 ? "user" : "ai") as MessageType,
    content,
    timestamp: (msg as any)?.createdAt,
    tableData,
  };
}

export function parseSearchInDataExploreResponse(
  apiResponse: unknown,
  datasetIds: string[],
): Message | null {
  if (!apiResponse || typeof apiResponse !== "object") {
    return null;
  }

  const response = apiResponse as {
    result?: {
      question?: string;
      data?: {
        InputParams?: Array<{
          lat?: number;
          lon?: number;
        }>;
      };
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
    };
  };

  if (!response.result) {
    return null;
  }

  const result = response.result;
  let tableData: Message["tableData"] | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let content = "Analysis completed.";

  // Extract coordinates from InputParams
  if (result.data?.InputParams && Array.isArray(result.data.InputParams)) {
    const inputParam = result.data.InputParams[0];
    if (inputParam?.lat && inputParam?.lon) {
      latitude =
        typeof inputParam.lat === "number" ? inputParam.lat : undefined;
      longitude =
        typeof inputParam.lon === "number" ? inputParam.lon : undefined;
    }
  }

  // Extract table data from entries
  if (
    result.entries &&
    Array.isArray(result.entries) &&
    result.entries.length > 0
  ) {
    const firstEntry = result.entries[0];
    const extractedTableData = firstEntry?.result?.table;
    if (extractedTableData) {
      tableData = extractedTableData;
      if (extractedTableData.columns && extractedTableData.rows) {
        content = "Table Results:\n";
      } else {
        content = "Data analysis completed.";
      }
    }
  }

  // Generate a unique ID that won't conflict with server message IDs
  // Use a prefix and timestamp to ensure uniqueness
  const messageId = `temp-ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id: messageId,
    type: "ai",
    content,
    timestamp: new Date(),
    tableData,
    sources: datasetIds.length,
    relatedDatasetIds: datasetIds,
    latitude,
    longitude,
  };
}
