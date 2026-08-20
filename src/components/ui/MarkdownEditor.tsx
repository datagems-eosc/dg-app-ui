"use client";

import {
  bold,
  code,
  codeBlock,
  divider,
  italic,
  link,
  orderedListCommand,
  title,
  unorderedListCommand,
} from "@uiw/react-md-editor/commands";
import "@uiw/react-md-editor/markdown-editor.css";
import { Eye, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";
import Switch from "./Switch";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  height?: number;
}

const toolbarCommands = [
  title,
  bold,
  italic,
  divider,
  unorderedListCommand,
  orderedListCommand,
  divider,
  link,
  code,
  codeBlock,
];

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  maxLength,
  height = 240,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"left" | "right">("left");

  const previewSwitch = {
    name: "preview-switch",
    keyCommand: "preview-switch",
    render: () => (
      <Switch
        leftIcon={Pencil}
        rightIcon={Eye}
        value={mode}
        onChange={setMode}
        leftLabel="Edit"
        rightLabel="Preview"
      />
    ),
  };

  return (
    <div className="w-full">
      {label && (
        <label
          className={cn(
            "block text-sm font-medium mb-1",
            error ? "text-red-550" : "text-gray-750",
          )}
        >
          {label}
          {required && <span className="ml-0.5 text-red-550">*</span>}
        </label>
      )}
      <div
        data-color-mode="light"
        className={cn(
          "rounded-2xl overflow-hidden border border-slate-350",
          error && "border-red-550",
        )}
      >
        <MDEditor
          value={value}
          onChange={(next) => onChange(next ?? "")}
          height={height}
          preview={mode === "left" ? "edit" : "preview"}
          visibleDragbar={false}
          commands={toolbarCommands}
          extraCommands={[previewSwitch]}
          textareaProps={{ placeholder, maxLength }}
          components={{
            preview: (source) => (
              <Markdown content={source} className="text-sm text-gray-750" />
            ),
          }}
        />
      </div>
      {maxLength && (
        <div className="mt-1 text-xs text-gray-650 text-right">
          {value.length}/{maxLength}
        </div>
      )}
      {error && (
        <p className="mt-1 text-descriptions-12-regular text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
