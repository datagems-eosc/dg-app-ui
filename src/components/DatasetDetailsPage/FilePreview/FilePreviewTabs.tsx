"use client";

import { useId } from "react";
import type { FilePreviewTab } from "@/types/filePreview";
import styles from "./FilePreviewTabs.module.scss";

interface FilePreviewTabsProps {
  idPrefix?: string;
  activeTab: FilePreviewTab;
  onTabChange: (tab: FilePreviewTab) => void;
}

const tabs: { key: FilePreviewTab; label: string; hasAI?: boolean }[] = [
  { key: "preview", label: "Preview" },
  { key: "statistics", label: "Statistics" },
  { key: "dataQuality", label: "Data Quality", hasAI: true },
];

export default function FilePreviewTabs({
  idPrefix,
  activeTab,
  onTabChange,
}: FilePreviewTabsProps) {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  return (
    <div
      className={styles.filePreviewTabs}
      role="tablist"
      aria-label="File preview"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          id={`${prefix}-${tab.key}`}
          aria-controls={`${prefix}-panel`}
          aria-selected={activeTab === tab.key}
          tabIndex={activeTab === tab.key ? 0 : -1}
          onKeyDown={(event) => {
            const targets: Record<string, number> = {
              Home: 0,
              End: tabs.length - 1,
              ArrowRight: (index + 1) % tabs.length,
              ArrowLeft: (index + tabs.length - 1) % tabs.length,
            };
            const next = targets[event.key];
            if (next === undefined) return;
            event.preventDefault();
            onTabChange(tabs[next].key);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
              [next]?.focus();
          }}
          onClick={() => onTabChange(tab.key)}
          className={`${styles.filePreviewTabs__tab} ${
            activeTab === tab.key ? styles["filePreviewTabs__tab--active"] : ""
          }`}
        >
          <span className={tab.hasAI ? styles["filePreviewTabs__tab--ai"] : ""}>
            {tab.label}
          </span>
          {tab.hasAI && (
            <span className={styles.filePreviewTabs__aiLabel}>AI</span>
          )}
        </button>
      ))}
    </div>
  );
}
