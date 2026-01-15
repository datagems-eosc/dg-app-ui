"use client";

import { Button } from "@ui/Button";
import { Copy, Quote } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetCitationSectionProps {
  citation: string;
}

export default function DatasetCitationSection({
  citation,
}: DatasetCitationSectionProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(citation);
  };

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Quote className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Citation</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className={styles.datasetSidebarSection__button}
        >
          <Copy className={styles.datasetSidebarSection__buttonIcon} />
          Copy
        </Button>
      </div>
      <div className={styles.datasetSidebarSection__citation}>
        <p className={styles.datasetSidebarSection__citationText}>{citation}</p>
      </div>
    </div>
  );
}
