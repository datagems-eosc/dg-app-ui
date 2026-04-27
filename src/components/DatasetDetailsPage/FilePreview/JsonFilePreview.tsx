"use client";

import { Button } from "@ui/Button";
import { Download } from "lucide-react";
import type { JsonFilePreviewData } from "@/types/filePreview";
import FilePreviewMetadata from "./FilePreviewMetadata";
import styles from "./JsonFilePreview.module.scss";

const JSON_PREVIEW_LINE_LIMIT = 150;

function highlightJsonLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  const patterns = [
    { regex: /^(\s+)/, className: styles.jsonFilePreview__whitespace },
    {
      regex: /^("[^"]*")(?=\s*:)/,
      className: styles.jsonFilePreview__key,
    },
    {
      regex: /^("(?:[^"\\]|\\.)*")/,
      className: styles.jsonFilePreview__string,
    },
    { regex: /^(-?\d+\.?\d*)/, className: styles.jsonFilePreview__number },
    { regex: /^(true|false)/, className: styles.jsonFilePreview__boolean },
    { regex: /^(null)/, className: styles.jsonFilePreview__null },
    {
      regex: /^([{}\[\]:,])/,
      className: styles.jsonFilePreview__punctuation,
    },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, className } of patterns) {
      const m = remaining.match(regex);
      if (m) {
        parts.push(
          <span key={key++} className={className}>
            {m[1]}
          </span>,
        );
        remaining = remaining.slice(m[1].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const nextChar = remaining[0];
      parts.push(
        <span key={key++} className={styles.jsonFilePreview__default}>
          {nextChar}
        </span>,
      );
      remaining = remaining.slice(1);
    }
  }

  return <>{parts}</>;
}

interface JsonFilePreviewProps {
  data: JsonFilePreviewData;
  onDownload?: () => void;
}

export default function JsonFilePreview({
  data,
  onDownload,
}: JsonFilePreviewProps) {
  const { filename, fileSize, description, keywords, content } = data;

  const lines = content.split("\n");
  const visibleLines = lines.slice(0, JSON_PREVIEW_LINE_LIMIT);

  return (
    <div className={styles.jsonFilePreview}>
      <div className={styles.jsonFilePreview__header}>
        <div className={styles.jsonFilePreview__headerInfo}>
          <h3 className={styles.jsonFilePreview__filename}>{filename}</h3>
          <span className={styles.jsonFilePreview__filesize}>({fileSize})</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownload?.()}
          className={styles.jsonFilePreview__downloadBtn}
        >
          <Download className={styles.jsonFilePreview__downloadIcon} />
          Download
        </Button>
      </div>

      <FilePreviewMetadata description={description} keywords={keywords} />

      <div className={styles.jsonFilePreview__codeWrapper}>
        <pre
          className={styles.jsonFilePreview__code}
          data-testid="json-preview"
        >
          <code>
            {visibleLines.map((line, i) => (
              <div key={i} className={styles.jsonFilePreview__line}>
                {highlightJsonLine(line)}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
