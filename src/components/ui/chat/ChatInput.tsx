"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "../Button";
import { CollectionsDropdown } from "../CollectionsDropdown";
import { cn } from "@/lib/utils";
import { Collection, ApiCollection } from "@/types/collection";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAddDatasets: () => void;
  collections?: {
    apiCollections: Collection[];
    collections: Collection[];
    extraCollections: ApiCollection[];
    isLoading: boolean;
  };
  selectedCollection?: Collection | null;
  onSelectCollection?: (collection: Collection | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  showAddDatasetsModal?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onAddDatasets,
  collections,
  selectedCollection,
  onSelectCollection,
  isLoading = false,
  disabled = false,
  error = null,
  showAddDatasetsModal = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const hasText = value.trim().length > 0;

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 155)}px`;
    }
  };

  const checkScroll = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setShowTopFade(textarea.scrollTop > 0);
      setShowBottomFade(
        textarea.scrollTop < textarea.scrollHeight - textarea.clientHeight - 1
      );
    }
  };

  useEffect(() => {
    adjustHeight();
    setTimeout(checkScroll, 10);
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasText && !disabled && !isLoading) {
        onSend();
      }
    }
  };

  return (
    <div
      className={cn(
        "w-full bg-white border rounded-2xl transition-all duration-300",
        "border-slate-350",
        "hover:border-slate-450",
        "focus-within:ring-2 focus-within:ring-[#2B7FFF33] focus-within:border-blue-850",
        error &&
          "border-red-550 focus-within:ring-red-550 focus-within:border-red-550",
        disabled &&
          "border-slate-200 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus-within:ring-0 focus-within:border-slate-200"
      )}
      style={{ width: "100%", maxWidth: "100%" }}
    >
      <div className="p-4 relative">
        <div className="relative">
          <textarea
            name="chat-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onScroll={checkScroll}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask me anything..."
            className={cn(
              "w-full border-none text-body-16-regular transition-all resize-none bg-transparent",
              "text-gray-750 placeholder-slate-450",
              "focus:outline-none focus:ring-0",
              error && "text-gray-750",
              disabled && "text-slate-450 cursor-not-allowed"
            )}
            style={{ minHeight: "60px", maxHeight: "150px" }}
            disabled={disabled}
          />

          {/* Top fade overlay */}
          {showTopFade && (
            <div
              className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"
              style={{ borderRadius: "8px 8px 0 0" }}
            />
          )}

          {/* Bottom fade overlay */}
          {showBottomFade && (
            <div
              className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"
              style={{ borderRadius: "0 0 8px 8px" }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-blue-500 text-sm">Sending...</span>
            </div>
          ) : (
            <>
              {collections && onSelectCollection ? (
                <CollectionsDropdown
                  collections={collections}
                  selectedCollection={selectedCollection || null}
                  onSelectCollection={onSelectCollection}
                  disabled={disabled}
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={onAddDatasets}
                  disabled={disabled}
                >
                  <span className="w-4 h-4 mr-2">📁</span>
                  {selectedCollection
                    ? selectedCollection.name.replace(/ Collection$/i, "")
                    : "Collections"}
                </Button>
              )}
              <Button
                variant="primary"
                className="p-1"
                size="icon"
                onClick={onSend}
                disabled={!value.trim() || disabled}
              >
                <ArrowUpRight className="w-4 h-4 text-icon" />
              </Button>
            </>
          )}
        </div>

        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </div>
    </div>
  );
}
