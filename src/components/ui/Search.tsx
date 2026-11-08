"use client";

import { Search as SearchIcon, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "./Input";
import { SmartFrame } from "./SmartSearch";

interface SearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  disabled?: boolean;
  size?: "medium" | "large";
  /** Smart search state: gradient frame when true, neutral grey frame when false. Unset keeps the plain box. */
  smart?: boolean;
}

export function Search({
  placeholder = "Search datasets...",
  value: externalValue,
  onChange,
  onSearch,
  onClear,
  className,
  disabled = false,
  size = "large",
  smart,
}: SearchProps) {
  const [internalValue, setInternalValue] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use external value if provided, otherwise use internal state
  const currentValue =
    externalValue !== undefined ? externalValue : internalValue;

  // Clear tooltip timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (externalValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);

    // Clear existing timer
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }

    // Show tooltip after 5 seconds if input is less than 3 characters
    if (newValue.length > 0 && newValue.length < 3) {
      tooltipTimerRef.current = setTimeout(() => {
        setShowTooltip(true);
        // Hide tooltip after 10 seconds
        setTimeout(() => setShowTooltip(false), 10000);
      }, 5000);
    } else {
      setShowTooltip(false);
    }
  };

  const handleClear = () => {
    if (externalValue === undefined) {
      setInternalValue("");
    }
    onChange?.("");
    onClear?.();
    setShowTooltip(false);

    // Clear timer
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
  };

  // Enter submits the form, so this is the only place that searches.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentValue.length < 3) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 10000);
      return;
    }
    onSearch?.(currentValue);
  };

  const showClearButton = currentValue.length > 0;

  const input = (
    <Input
      type="text"
      name="search"
      size={size}
      placeholder={placeholder}
      value={currentValue}
      onChange={handleChange}
      autoComplete="off"
      enterKeyHint="search"
      inputMode="search"
      rightIcon={
        <div className="flex items-center gap-1">
          {showClearButton && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 p-1.5 hover:bg-slate-75 rounded transition-colors"
              aria-label="Clear search"
              disabled={disabled}
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <button
            type="submit"
            className="flex-shrink-0 p-1.5 hover:bg-slate-75 rounded transition-colors disabled:opacity-50"
            aria-label="Search"
            disabled={disabled}
          >
            <SearchIcon className="w-4 h-4 text-icon" />
          </button>
        </div>
      }
      className={`text-base sm:text-sm ${
        smart === undefined
          ? ""
          : smart
            ? "border-transparent hover:border-transparent bg-white"
            : "border-transparent hover:border-transparent bg-slate-50"
      } ${className || ""}`}
      disabled={disabled}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {smart === undefined ? (
        input
      ) : (
        <SmartFrame active={smart} className="rounded-4xl">
          {input}
        </SmartFrame>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 text-white text-sm px-3 py-2 rounded-md shadow-lg max-w-xs">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-1.5">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            </div>
            <div>
              <p className="font-medium">
                Search requires at least 3 characters
              </p>
              <p className="text-gray-300 text-xs mt-1">
                Please enter more text to search datasets
              </p>
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800"></div>
        </div>
      )}
    </form>
  );
}
