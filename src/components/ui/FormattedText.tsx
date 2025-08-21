"use client";

import React from "react";

interface FormattedTextProps {
  text?: string | null;
  /**
   * Tailwind classes to apply to the wrapper element
   */
  className?: string;
  /**
   * If true, applies line-clamp utility via className (consumer supplies it)
   */
  as?: React.ElementType;
}

/**
 * Renders text with:
 * - Decoded \uXXXX escapes (handles common JSON-escaped inputs)
 * - Preserved newlines as <br />
 * - Auto-linked URLs (http/https)
 */
export default function FormattedText({
  text,
  className,
  as: asProp,
}: FormattedTextProps) {
  const Tag = (asProp || "span") as React.ElementType;
  const safeText = typeof text === "string" ? text : "";

  // Decode common unicode escapes like \u2010, \u00b0
  const decoded = React.useMemo(() => {
    let processed = safeText;

    // Collapse double-escaped sequences for u, n, r, t (e.g., \\u -> \u, \\n -> \n)
    processed = processed
      .replace(/\\{2,}u/gi, "\\u")
      .replace(/\\{2,}n/g, "\\n")
      .replace(/\\{2,}r/g, "\\r")
      .replace(/\\{2,}t/g, "\\t");

    // Decode any \uXXXX into actual characters
    processed = processed.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _m;
      }
    });

    // Convert literal escape sequences to actual characters
    processed = processed
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");

    // Normalize actual CRLF to LF
    processed = processed.replace(/\r\n/g, "\n");

    return processed;
  }, [safeText]);

  // Linkify URLs
  const urlRegex =
    /(https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;

  const parts = React.useMemo(() => {
    // Split by URLs to interleave <a> and text
    const segments: Array<{ type: "text" | "link"; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // Reset regex state in case of multiple renders
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(decoded)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: decoded.slice(lastIndex, match.index),
        });
      }
      segments.push({ type: "link", value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < decoded.length) {
      segments.push({ type: "text", value: decoded.slice(lastIndex) });
    }
    return segments;
  }, [decoded]);

  // Render with newline preservation
  const renderSegment = (
    segment: { type: "text" | "link"; value: string },
    key: number
  ) => {
    if (segment.type === "link") {
      return (
        <a
          key={key}
          href={segment.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-words"
        >
          {segment.value}
        </a>
      );
    }
    // Split on newlines and interleave <br />
    const lines = segment.value.split(/\r?\n/);
    return (
      <React.Fragment key={key}>
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  };

  return (
    <Tag className={className}>
      {parts.map((p, idx) => renderSegment(p, idx))}
    </Tag>
  );
}
