"use client";

import Markdown from "@ui/Markdown";
import styles from "./DatasetDescriptionSection.module.scss";

interface DatasetDescriptionSectionProps {
  description: string;
  title?: string;
  headingLevel?: 3 | 4;
}

export default function DatasetDescriptionSection({
  description,
  title = "Description",
  headingLevel = 3,
}: DatasetDescriptionSectionProps) {
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <div className={styles.datasetDescriptionSection}>
      <Heading
        className={
          headingLevel === 4
            ? styles.subheading
            : styles.datasetDescriptionSection__title
        }
      >
        {title}
      </Heading>
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
