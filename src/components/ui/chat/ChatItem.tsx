"use client";

import {
  MessageCircleMore,
  MoreVertical,
  TextCursorInput,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { formatRelativeTime } from "@/lib/utils";
import { Toast } from "../Toast";
import { Tooltip } from "../Tooltip";

interface ConversationListItem {
  id: string;
  name?: string;
  createdAt?: string;
  eTag: string;
}

interface ChatItemProps {
  conversation: ConversationListItem;
  isActive?: boolean;
  onConversationUpdate?: (
    id: string,
    newName: string,
    newETag?: string,
  ) => void;
  onDeleteConversation?: (
    conversationId: string,
    conversationName: string,
  ) => void;
}

export function ChatItem({
  conversation,
  isActive = false,
  onConversationUpdate,
  onDeleteConversation,
}: ChatItemProps) {
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(conversation.name || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setShowDropdown(false);
    setEditName(conversation.name || "Untitled Conversation");
  };

  const handleSaveEdit = async () => {
    const token = (session as any)?.accessToken;
    const trimmedName = editName.trim();

    // Don't send request if no changes or if name is empty
    if (!trimmedName || !token || trimmedName === (conversation.name || "")) {
      setIsEditing(false);
      setEditName(conversation.name || "");
      return;
    }

    // Validate name length (max 300 characters)
    if (trimmedName.length > 300) {
      console.error("Conversation name cannot exceed 300 characters");
      setEditName(conversation.name || "");
      setIsEditing(false);
      return;
    }

    // Check if ETag is available - it's required by the backend
    if (!conversation.eTag) {
      console.error("ETag is required to update conversation");
      setEditName(conversation.name || "");
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const result = await apiClient.updateConversation(
        conversation.id,
        {
          name: trimmedName,
          eTag: conversation.eTag,
        },
        token,
      );
      // Update the conversation with new name and eTag
      onConversationUpdate?.(conversation.id, trimmedName, result.eTag);
      setIsEditing(false);
      setToastType("success");
      setToastMessage("Conversation name updated successfully!");
      setShowToast(true);
    } catch (error) {
      console.error("Failed to update conversation:", error);
      setEditName(conversation.name || "");
      setIsEditing(false); // Always exit edit mode on error
      setToastType("error");
      setToastMessage("Failed to update conversation name");
      setShowToast(true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(conversation.name || "");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    if (onDeleteConversation) {
      onDeleteConversation(conversation.id, displayName);
    }
    setShowDropdown(false);
  };

  const displayName = conversation.name || "Untitled Conversation";
  const shouldShowTooltip = displayName.length > 30;

  const content = (
    <div className="flex gap-1 w-full">
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex flex-start items-center gap-2 min-w-0">
          <MessageCircleMore className="w-4 h-4 flex-shrink-0 text-blue-850 group-hover:text-blue-600" />
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              disabled={isUpdating}
              className="text-body-14-medium text-gray-750 bg-blue-200 px-2 py-1 rounded outline-none focus:ring-2 focus:ring-blue-400 flex-1 min-w-0"
              style={{ backgroundColor: "#DBEAFE" }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Tooltip
              content={shouldShowTooltip ? displayName : ""}
              position="top"
              className="flex-1 min-w-0"
            >
              <span className="text-body-14-medium truncate text-gray-750 block">
                {displayName}
              </span>
            </Tooltip>
          )}
        </div>

        <div className="flex justify-start">
          <span className="text-descriptions-12-regular tracking-1p text-gray-650 text-right">
            {conversation.createdAt
              ? formatRelativeTime(conversation.createdAt)
              : ""}
          </span>
        </div>
      </div>
      {!isEditing && (
        <div className="flex-none relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className={`opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 hover:bg-white rounded-[3px] transition-all duration-200 ${showDropdown ? "opacity-100" : ""}`}
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>

          {showDropdown && (
            <div className="absolute top-[60%] right-0 w-50 bg-white rounded-md shadow-md border border-slate-200 p-1 z-[60]">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEdit();
                }}
                className="flex items-center gap-2 rounded-md w-full px-3 py-2 text-left text-gray-750 hover:bg-slate-100 transition-colors text-body-14-regular"
              >
                <TextCursorInput className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex items-center gap-2 rounded-md w-full px-3 py-2 text-left text-gray-750 hover:bg-slate-100 transition-colors text-body-14-regular"
              >
                <Trash className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const containerClasses = isActive
    ? "flex flex-col gap-1 p-3 rounded-lg border border-blue-300 cursor-default group"
    : "flex flex-col gap-1 p-3 rounded-lg bg-white hover:bg-slate-75 transition-colors group";

  if (isActive || isEditing) {
    return (
      <>
        <div
          className={containerClasses}
          onClick={(e) => {
            if (isEditing) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {content}
        </div>
        <Toast
          message={toastMessage}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
          type={toastType}
        />
      </>
    );
  }

  return (
    <>
      <Link href={`/chat/${conversation.id}`} className={containerClasses}>
        {content}
      </Link>
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        type={toastType}
      />
    </>
  );
}
