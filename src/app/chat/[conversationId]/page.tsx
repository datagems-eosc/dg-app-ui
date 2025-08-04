// Dynamic chat page for /chat/[conversationId]
import ChatPage from "../page";
import React from "react";

// Wrapper to hide conversation name on details page
export default function ConversationChatPage() {
  return <ChatPage showConversationName={false} hideCollectionActions={true} />;
}
