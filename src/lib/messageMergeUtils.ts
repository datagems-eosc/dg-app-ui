import type { Message } from "@/types/chat";

function areMessagesDuplicates(msg1: Message, msg2: Message): boolean {
  if (msg1.type !== msg2.type) {
    return false;
  }

  const content1 = msg1.content.trim();
  const content2 = msg2.content.trim();

  if (content1 !== content2) {
    return false;
  }

  // Timestamps must be within 5 seconds
  const time1 =
    msg1.timestamp instanceof Date
      ? msg1.timestamp.getTime()
      : new Date(msg1.timestamp).getTime();
  const time2 =
    msg2.timestamp instanceof Date
      ? msg2.timestamp.getTime()
      : new Date(msg2.timestamp).getTime();

  const timeDiff = Math.abs(time1 - time2);
  return timeDiff <= 5000;
}

export function mergeMessages(
  serverMessages: Message[],
  localMessages: Message[],
): Message[] {
  // If no local messages, just return server messages
  if (localMessages.length === 0) {
    return [...serverMessages].sort((a, b) => {
      const aTime =
        a.timestamp instanceof Date
          ? a.timestamp.getTime()
          : new Date(a.timestamp).getTime();
      const bTime =
        b.timestamp instanceof Date
          ? b.timestamp.getTime()
          : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
  }

  // Find local messages that don't have a server duplicate
  const localMessagesToKeep = localMessages.filter((localMsg) => {
    const hasServerDuplicate = serverMessages.some((serverMsg) =>
      areMessagesDuplicates(localMsg, serverMsg),
    );

    return !hasServerDuplicate;
  });

  // Combine: server messages (authoritative) + local messages without duplicates
  const merged = [...serverMessages, ...localMessagesToKeep];

  // Sort by timestamp
  merged.sort((a, b) => {
    const aTime =
      a.timestamp instanceof Date
        ? a.timestamp.getTime()
        : new Date(a.timestamp).getTime();
    const bTime =
      b.timestamp instanceof Date
        ? b.timestamp.getTime()
        : new Date(b.timestamp).getTime();
    return aTime - bTime;
  });

  return merged;
}

export function detectNewAIMessages(
  serverMessages: Message[],
  currentMessages: Message[],
): Message[] {
  const currentMessageIds = new Set(currentMessages.map((msg) => msg.id));

  return serverMessages.filter(
    (msg) => msg.type === "ai" && !currentMessageIds.has(msg.id),
  );
}
