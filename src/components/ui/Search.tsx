"use client";

import React, { useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { Input } from "./Input";

interface SearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Search({
  placeholder = "Search datasets...",
  value: externalValue,
  onChange,
  onSearch,
  onClear,
  className,
  disabled = false,
}: SearchProps) {
  const [internalValue, setInternalValue] = useState("");

  // Use external value if provided, otherwise use internal state
  const currentValue =
    externalValue !== undefined ? externalValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (externalValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleClear = () => {
    if (externalValue === undefined) {
      setInternalValue("");
    }
    onChange?.("");
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch?.(currentValue);
    }
  };

  const showClearButton = currentValue.length > 0;

  return (
    <div className="relative">
      <Input
        type="text"
        name="search"
        size="large"
        placeholder={placeholder}
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        icon={<SearchIcon className="w-4 h-4 text-icon" />}
        rightIcon={
          showClearButton ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 p-1.5 hover:bg-slate-75 rounded transition-colors"
              aria-label="Clear search"
              disabled={disabled}
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          ) : undefined
        }
        className={className}
        disabled={disabled}
      />
    </div>
  );
}
