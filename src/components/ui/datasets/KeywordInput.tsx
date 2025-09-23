"use client";

import React, { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordInputProps {
  value: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export function KeywordInput({
  value = [],
  onChange,
  placeholder = "Separate with commas e.g. encyclopedia, historical texts, knowledge graph",
  label,
  error,
  disabled = false,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState("");

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
    const keyword = inputValue.trim().replace(/,$/, ""); // Remove trailing comma
    if (keyword && !value.includes(keyword)) {
      onChange([...value, keyword]);
    }
    setInputValue("");
  };

  const removeKeyword = (indexToRemove: number) => {
    const newKeywords = value.filter((_, index) => index !== indexToRemove);
    onChange(newKeywords);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Check if user typed a comma
    if (newValue.includes(",")) {
      const keywords = newValue.split(",").map(k => k.trim()).filter(k => k);
      const lastKeyword = keywords.pop() || "";
      
      // Add all complete keywords
      const newKeywords = [...value];
      keywords.forEach(keyword => {
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

  return (
    <div className="w-full">
      {label && (
        <label
          className={cn(
            "block text-sm font-medium mb-1",
            disabled
              ? "text-gray-650"
              : error
                ? "text-red-550"
                : "text-gray-750"
          )}
        >
          {label}
        </label>
      )}
      
      <div
        className={cn(
          "min-h-[42px] px-3 py-1.75 border rounded-4xl transition-colors",
          "border-slate-350 hover:border-slate-450",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-850 focus-within:ring-offset-1 focus-within:ring-offset-white",
          error && "border-red-550 focus-within:ring-red-550",
          disabled && "border-slate-200 bg-slate-75 cursor-not-allowed hover:border-slate-200"
        )}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {value.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              {keyword}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${keyword}`}
                >
                  <X className="w-3 h-3" />
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
            disabled={disabled}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm font-normal text-gray-750 placeholder-slate-400 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      
      {error && (
        <p className="mt-1 text-descriptions-12-regular text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
