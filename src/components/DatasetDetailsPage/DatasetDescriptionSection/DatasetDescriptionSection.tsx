"use client";

import Markdown from "@ui/Markdown";
import styles from "./DatasetDescriptionSection.module.scss";

interface DatasetDescriptionSectionProps {
  description: string;
}

export default function DatasetDescriptionSection({
  description,
}: DatasetDescriptionSectionProps) {
  return (
    <div className={styles.datasetDescriptionSection}>
      <h3 className={styles.datasetDescriptionSection__title}>Description</h3>
      {description?.trim() ? (
        <Markdown
          className={styles.datasetDescriptionSection__text}
          content={description}
        />
      ) : (
        <p className={styles.datasetDescriptionSection__text}>
          No description available.
        </p>
      )}
    </div>
  );
}
