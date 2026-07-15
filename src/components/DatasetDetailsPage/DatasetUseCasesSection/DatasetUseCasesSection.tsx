"use client";

import FormattedText from "@ui/FormattedText";
import styles from "./DatasetUseCasesSection.module.scss";

interface DatasetUseCasesSectionProps {
  useCases?: string;
}

export default function DatasetUseCasesSection({
  useCases,
}: DatasetUseCasesSectionProps) {
  return (
    <div className={styles.datasetUseCasesSection}>
      <h3 className={styles.datasetUseCasesSection__title}>
        Potential Use Cases
      </h3>
      <div className={styles.datasetUseCasesSection__content}>
        {useCases?.trim() ? (
          <FormattedText
            as="div"
            className={styles.datasetUseCasesSection__text}
            text={useCases}
          />
        ) : (
          <p className={styles.datasetUseCasesSection__empty}>
            No use-case information available.
          </p>
        )}
      </div>
    </div>
  );
}
