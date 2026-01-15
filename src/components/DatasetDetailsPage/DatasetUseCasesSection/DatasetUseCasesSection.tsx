"use client";

import FormattedText from "@ui/FormattedText";
import styles from "./DatasetUseCasesSection.module.scss";

interface DatasetUseCasesSectionProps {
  useCases?: string;
}

export default function DatasetUseCasesSection({
  useCases,
}: DatasetUseCasesSectionProps) {
  const defaultUseCases = (
    <ul className={styles.datasetUseCasesSection__list}>
      <li className={styles.datasetUseCasesSection__item}>
        <span className={styles.datasetUseCasesSection__itemTitle}>
          Weather Prediction Models:
        </span>
        <span>
          {" "}
          Researchers and data scientists can use this dataset to develop and
          train weather prediction models for various locations.
        </span>
      </li>
      <li className={styles.datasetUseCasesSection__item}>
        <span className={styles.datasetUseCasesSection__itemTitle}>
          Climate Studies:
        </span>
        <span>
          {" "}
          The dataset can be used for climate studies and analysis to understand
          weather patterns and trends in different regions.
        </span>
      </li>
      <li className={styles.datasetUseCasesSection__item}>
        <span className={styles.datasetUseCasesSection__itemTitle}>
          Educational Purposes:
        </span>
        <span>
          {" "}
          Students and educators can use this dataset to learn about data
          analysis, visualization, and modeling techniques in the context of
          weather data.
        </span>
      </li>
    </ul>
  );

  return (
    <div className={styles.datasetUseCasesSection}>
      <h3 className={styles.datasetUseCasesSection__title}>
        Potential Use Cases
      </h3>
      <div className={styles.datasetUseCasesSection__content}>
        {useCases ? (
          <FormattedText
            as="div"
            className={styles.datasetUseCasesSection__text}
            text={useCases}
          />
        ) : (
          defaultUseCases
        )}
      </div>
    </div>
  );
}
