"use client";

import { Check, Copy } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Button } from "@/components/ui/Button";

export default function RcaiCodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const t = setTimeout(() => setIsCopied(false), 2000);
    return () => clearTimeout(t);
  }, [isCopied]);

  const onCopy = useCallback(async () => {
    if (isCopied) return;
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  }, [isCopied, value]);

  return (
    <div className="relative rounded-xl w-full bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-100">
        <span className="text-xs lowercase opacity-80">
          {language || "code"}
        </span>
        <Button variant="outline" size="icon" onClick={onCopy}>
          {isCopied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={coldarkDark as any}
        PreTag="div"
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem",
        }}
        codeTagProps={{
          style: {
            fontSize: "0.9rem",
            fontFamily: "var(--font-mono)",
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
