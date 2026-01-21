"use client";

import type { FilePreviewTab } from "@/types/filePreview";
import styles from "./FilePreviewTabs.module.scss";

interface FilePreviewTabsProps {
  activeTab: FilePreviewTab;
  onTabChange: (tab: FilePreviewTab) => void;
}

const tabs: { key: FilePreviewTab; label: string; hasAI?: boolean }[] = [
  { key: "preview", label: "Preview" },
  { key: "statistics", label: "Statistics" },
  { key: "dataQuality", label: "Data Quality", hasAI: true },
];

export default function FilePreviewTabs({
  activeTab,
  onTabChange,
}: FilePreviewTabsProps) {
  return (
    <div className={styles.filePreviewTabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
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
