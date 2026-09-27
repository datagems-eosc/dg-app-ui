"use client";

import { X } from "lucide-react";
import type React from "react";
import { type KeyboardEvent, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface KeywordInputProps {
  value: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  maxItems?: number;
}

export function KeywordInput({
  value = [],
  onChange,
  placeholder = "Separate with commas e.g. encyclopedia, historical texts, knowledge graph",
  label,
  error,
  disabled = false,
  required = true,
  maxLength = 250,
  maxItems,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [limitError, setLimitError] = useState("");
  const errorId = useId();
  const atLimit = maxItems !== undefined && value.length >= maxItems;
  const displayedError = limitError || error;

  const exceedsLimit = (input: string) => {
    if (maxItems === undefined) return false;
    const candidates = input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      candidates.length <= maxItems &&
      new Set([...value, ...candidates]).size <= maxItems
    )
      return false;
    setLimitError(
      maxItems === 1
        ? "Add only one value."
        : `Add no more than ${maxItems} values.`,
    );
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      // Remove last keyword if input is empty and backspace is pressed
      const newKeywords = [...value];
      newKeywords.pop();
      onChange(newKeywords);
    }
  };

  const addKeyword = () => {
    if (exceedsLimit(inputValue)) return;
    if (maxItems !== undefined) {
      const candidates = inputValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (candidates.length > 0)
        onChange([...new Set([...value, ...candidates])]);
      setInputValue("");
      setLimitError("");
      return;
    }
    const keyword = inputValue.trim().replace(/,$/, ""); // Remove trailing comma
    if (keyword && !value.includes(keyword)) {
      onChange([...value, keyword]);
    }
    setInputValue("");
    setLimitError("");
  };

  const removeKeyword = (indexToRemove: number) => {
    const newKeywords = value.filter((_, index) => index !== indexToRemove);
    onChange(newKeywords);
    setLimitError("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLimitError("");
    if (exceedsLimit(newValue)) {
      setInputValue(newValue);
      return;
    }

    // Check if user typed a comma
    if (newValue.includes(",")) {
      const keywords = newValue
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);
      const lastKeyword = keywords.pop() || "";

      // Add all complete keywords
      const newKeywords = [...value];
      keywords.forEach((keyword) => {
        if (keyword && !newKeywords.includes(keyword)) {
          newKeywords.push(keyword);
        }
      });

      onChange(newKeywords);
      setInputValue(lastKeyword);
    } else {
      setInputValue(newValue);
    }
  };

  const getCurrentLength = () => {
    const combined = [...value, inputValue].filter(Boolean).join(", ");
    return combined.length;
  };

  return (
    <div className="w-full">
      {label && (
        <label
          className={cn(
            "block text-sm font-medium mb-1",
            disabled
              ? "text-gray-650"
              : displayedError
                ? "text-red-550"
                : "text-gray-750",
          )}
        >
          {label}
          {required && <span className="ml-0.5 text-red-550">*</span>}
        </label>
      )}

      <div
        className={cn(
          "min-h-[40px] px-3 pt-2 pb-1.75 border transition-colors",
          getCurrentLength() > 90 ? "rounded-[20px]" : "rounded-4xl",
          value.length > 0 && "p-0.75",
          "border-slate-350 hover:border-slate-450",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-850 focus-within:ring-offset-1 focus-within:ring-offset-white",
          displayedError && "border-red-550 focus-within:ring-red-550",
          disabled &&
            "border-slate-200 bg-slate-75 cursor-not-allowed hover:border-slate-200",
        )}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {value.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1.75 bg-slate-100 text-descriptions-12-medium tracking-1p text-gray-750 rounded-full"
            >
              {keyword}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="cursor-pointer rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${keyword}`}
                >
                  <X className="w-3 h-3 text-slate-450" />
                </button>
              )}
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={addKeyword}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled || atLimit}
            aria-required={required}
            aria-label={label}
            aria-invalid={displayedError ? true : undefined}
            aria-describedby={displayedError ? errorId : undefined}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm font-normal text-gray-750 placeholder-slate-400 disabled:cursor-not-allowed"
            style={{ alignSelf: "center" }}
          />
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-650 text-right">
        {getCurrentLength()}/{maxLength}
      </div>

      {displayedError && (
        <p
          id={errorId}
          className="mt-1 text-descriptions-12-regular text-red-500"
        >
          {displayedError}
        </p>
      )}
    </div>
  );
}
