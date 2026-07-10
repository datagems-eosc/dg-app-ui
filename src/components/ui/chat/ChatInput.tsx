"use client";

import { ArrowUpRight, CloudSun } from "lucide-react";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { cn } from "@/lib/utils";
import type { ApiCollection, Collection } from "@/types/collection";
import { Button } from "../Button";
import { CollectionsDropdown } from "../CollectionsDropdown";
import SmartSwitch from "../SmartSwitch";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAddDatasets: () => void;
  staticCollectionLabel?: string;
  staticCollectionIcon?: React.ComponentType<{ className?: string }>;
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
  showCollectionsButton?: boolean;
}

export interface ChatInputRef {
  focus: () => void;
  setCursorToEnd: () => void;
}

export const ChatInput = React.forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      onAddDatasets,
      staticCollectionLabel,
      staticCollectionIcon: StaticCollectionIcon = CloudSun,
      collections,
      selectedCollection,
      onSelectCollection,
      isLoading = false,
      disabled = false,
      error = null,
      showAddDatasetsModal = false,
      showCollectionsButton = true,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [_isFocused, setIsFocused] = useState(false);
    const [showTopFade, setShowTopFade] = useState(false);
    const [showBottomFade, setShowBottomFade] = useState(false);
    const [isExpertMode, setIsExpertMode] = useState(false);
    const expertModeEnabled = useFeatureFlag("expertMode");
    const generalChatEnabled = useFeatureFlag("generalChat");
    const hasText = value.trim().length > 0;

    useEffect(() => {
      try {
        const saved = window.localStorage.getItem("expertMode");
        if (saved === "1") setIsExpertMode(true);
        if (saved === "0") setIsExpertMode(false);
      } catch {}
    }, []);

    useEffect(() => {
      try {
        window.localStorage.setItem("expertMode", isExpertMode ? "1" : "0");
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("expert-mode-change", {
            detail: { enabled: isExpertMode },
          }),
        );
      } catch {}
    }, [isExpertMode]);

    // Expose focus and setCursorToEnd methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
      setCursorToEnd: () => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      },
    }));

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
          textarea.scrollTop <
            textarea.scrollHeight - textarea.clientHeight - 1,
        );
      }
    };

    useEffect(() => {
      adjustHeight();
      setTimeout(checkScroll, 10);
    }, [adjustHeight, checkScroll]);

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
          "border-slate-200",
          "hover:border-slate-350",
          "focus-within:border-slate-350",
          error && "border-red-550 focus-within:border-red-550",
          disabled &&
            "border-slate-200 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus-within:ring-0 focus-within:border-slate-200",
        )}
        style={{
          width: "100%",
          maxWidth: "100%",
          outline: "4px solid rgba(202, 213, 226, 0.25)",
          outlineOffset: 0,
        }}
      >
        <div className="p-3 sm:p-4 relative">
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
                "w-full border-none transition-all resize-none bg-transparent",
                "text-descriptions-14-regular sm:text-body-16-regular",
                "text-gray-750 placeholder-slate-450",
                "focus:outline-none focus:ring-0",
                error && "text-gray-750",
                disabled && "text-slate-450 cursor-not-allowed",
              )}
              style={{ minHeight: "52px", maxHeight: "140px" }}
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

          <div className="flex items-center justify-between gap-2 mt-3 sm:mt-4">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-blue-500 text-sm">Sending...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {staticCollectionLabel ? (
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-3xl shadow-s1 border border-slate-350 bg-white h-10 px-4 py-2",
                        disabled &&
                          "opacity-50 cursor-not-allowed pointer-events-none",
                      )}
                    >
                      <StaticCollectionIcon className="w-4 h-4 text-slate-700" />
                      <span className="text-body-14-regular text-gray-750 whitespace-nowrap select-none">
                        {staticCollectionLabel}
                      </span>
                    </div>
                  ) : null}
                  {!generalChatEnabled &&
                    (collections && onSelectCollection ? (
                      <CollectionsDropdown
                        collections={collections}
                        selectedCollection={selectedCollection || null}
                        onSelectCollection={onSelectCollection}
                        disabled={disabled}
                      />
                    ) : showCollectionsButton ? (
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
                    ) : null)}

                  {expertModeEnabled && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-3 rounded-3xl shadow-s1 border border-slate-350 bg-white h-10 px-4 py-2",
                        disabled &&
                          "opacity-50 cursor-not-allowed pointer-events-none",
                      )}
                    >
                      <SmartSwitch
                        checked={isExpertMode}
                        onChange={setIsExpertMode}
                        ariaLabel="Expert mode"
                        disabled={disabled}
                        size="sm"
                      />
                      <span
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => {
                          if (disabled) return;
                          setIsExpertMode((current) => !current);
                        }}
                        onKeyDown={(e) => {
                          if (disabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setIsExpertMode((current) => !current);
                          }
                        }}
                        className={cn(
                          "text-body-14-regular text-gray-750 whitespace-nowrap select-none",
                          disabled ? "cursor-not-allowed" : "cursor-pointer",
                        )}
                        aria-label="Toggle expert mode"
                      >
                        Expert Mode
                      </span>
                    </div>
                  )}
                </div>

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
  },
);

ChatInput.displayName = "ChatInput";
