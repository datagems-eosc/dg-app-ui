"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Box, Plus } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetCollectionSectionProps {
  collectionLabels: string[];
  onAddClick: () => void;
}

export default function DatasetCollectionSection({
  collectionLabels,
  onAddClick,
}: DatasetCollectionSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Box className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Collection</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddClick}
          className={styles.datasetSidebarSection__button}
        >
          <Plus className={styles.datasetSidebarSection__buttonIcon} />
          Add
        </Button>
      </div>
      {collectionLabels.map((label, index) => (
        <Chip
          key={`${label}-${index}`}
          color="grey"
          variant="regular"
          size="sm"
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}
