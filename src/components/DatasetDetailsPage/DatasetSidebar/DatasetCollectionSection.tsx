"use client";

import { Button } from "@ui/Button";
import { Box, Plus, X } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

export interface SidebarCollectionRef {
  id: string;
  name: string;
}

interface DatasetCollectionSectionProps {
  collections: SidebarCollectionRef[];
  onAddClick: () => void;
  onRemove: (collection: SidebarCollectionRef) => void;
  isRemoving?: (collectionId: string) => boolean;
}

export default function DatasetCollectionSection({
  collections,
  onAddClick,
  onRemove,
  isRemoving,
}: DatasetCollectionSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Box className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Collections</h3>
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
      {collections.length > 0 ? (
        <div className={styles.datasetSidebarSection__chips}>
          {collections.map((collection) => {
            const removing = isRemoving?.(collection.id) ?? false;
            return (
              <span
                key={collection.id}
                className={styles.datasetSidebarSection__chipWithRemove}
                data-testid={`collection-chip-${collection.id}`}
              >
                <span
                  className={styles.datasetSidebarSection__chipLabel}
                  title={collection.name}
                >
                  {collection.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(collection)}
                  disabled={removing}
                  aria-label={`Remove dataset from ${collection.name}`}
                  className={styles.datasetSidebarSection__chipRemoveBtn}
                >
                  <X className={styles.datasetSidebarSection__chipRemoveIcon} />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <span className={styles.datasetSidebarSection__emptyText}>
          Not in any collection yet.
        </span>
      )}
    </div>
  );
}
