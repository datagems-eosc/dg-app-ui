"use client";

import { Chip } from "@ui/Chip";
import styles from "./DatasetTagsSection.module.scss";

interface DatasetTagsSectionProps {
  title: string;
  headingLevel?: 3 | 4;
  items: string[];
  /** Shows a placeholder chip per item instead of the items. */
  isLoading?: boolean;
}

export default function DatasetTagsSection({
  title,
  headingLevel = 3,
  items,
  isLoading = false,
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
      {isLoading ? (
        <div
          role="status"
          aria-label={`Loading ${title}`}
          className={styles.datasetTagsSection__list}
        >
          {items.map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="h-8 w-28 animate-pulse rounded-full bg-slate-200"
            />
          ))}
        </div>
      ) : (
        <div className={styles.datasetTagsSection__list}>
          {items.map((item, index) => (
            <Chip
              key={index}
              color="grey"
              variant="regular"
              size="sm"
              className="h-auto min-h-8 max-w-full [overflow-wrap:anywhere]"
            >
              {item}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
