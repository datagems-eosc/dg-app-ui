"use client";

import { Chip } from "@ui/Chip";
import styles from "./DatasetTagsSection.module.scss";

interface DatasetTagsSectionProps {
  title: string;
  items: string[];
}

export default function DatasetTagsSection({
  title,
  items,
}: DatasetTagsSectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={styles.datasetTagsSection}>
      <h3 className={styles.datasetTagsSection__title}>{title}</h3>
      <div className={styles.datasetTagsSection__list}>
        {items.map((item, index) => (
          <Chip key={index} color="info" variant="outline" size="sm">
            {item}
          </Chip>
        ))}
      </div>
    </div>
  );
}
