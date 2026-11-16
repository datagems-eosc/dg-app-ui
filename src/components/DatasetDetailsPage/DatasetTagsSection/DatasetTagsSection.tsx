"use client";

import { Chip } from "@ui/Chip";
import styles from "./DatasetTagsSection.module.scss";

interface DatasetTagsSectionProps {
  title: string;
  headingLevel?: 3 | 4;
  items: string[];
}

export default function DatasetTagsSection({
  title,
  headingLevel = 3,
  items,
}: DatasetTagsSectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <div className={styles.datasetTagsSection}>
      <Heading
        className={
          headingLevel === 4
            ? styles.subheading
            : styles.datasetTagsSection__title
        }
      >
        {title}
      </Heading>
      <div className={styles.datasetTagsSection__list}>
        {items.map((item, index) => (
          <Chip
            key={index}
            color="info"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full [overflow-wrap:anywhere]"
          >
            {item}
          </Chip>
        ))}
      </div>
    </div>
  );
}
