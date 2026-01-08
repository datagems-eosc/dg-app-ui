"use client";

import FormattedText from "@ui/FormattedText";
import type { DatasetPlus } from "@/data/dataset";
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
      <FormattedText
        as="p"
        className={styles.datasetDescriptionSection__text}
        text={description || "No description available."}
      />
    </div>
  );
}
