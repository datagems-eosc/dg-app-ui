"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Box, Plus } from "lucide-react";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetCollectionSectionProps {
  displayCollection: string;
  onAddClick: () => void;
}

export default function DatasetCollectionSection({
  displayCollection,
  onAddClick,
}: DatasetCollectionSectionProps) {
  const hideGeneralChat = useFeatureFlag("generalChat");
  const showAddButton = !hideGeneralChat;

  // Nothing to show and nothing to do: omit the section and its spacing.
  if (!displayCollection && !showAddButton) return null;

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Box className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Collection</h3>
        </div>
        {showAddButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddClick}
            className={styles.datasetSidebarSection__button}
          >
            <Plus className={styles.datasetSidebarSection__buttonIcon} />
            Add
          </Button>
        )}
      </div>
      {displayCollection && (
        <Chip color="grey" variant="regular" size="sm">
          {displayCollection}
        </Chip>
      )}
    </div>
  );
}
