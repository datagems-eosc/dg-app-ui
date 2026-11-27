"use client";

import { Button } from "@ui/Button";
import { FoldedChipList } from "@ui/FoldedChipList";
import { Plus } from "lucide-react";
import DatasetSidebarSection, {
  sidebarNoteClass,
} from "./DatasetSidebarSection";

interface DatasetCollectionSectionProps {
  collectionLabels: string[];
  onAddClick: () => void;
}

export default function DatasetCollectionSection({
  collectionLabels,
  onAddClick,
}: DatasetCollectionSectionProps) {
  return (
    <DatasetSidebarSection
      title="Collections"
      action={
        <Button
          variant="outline"
          size="sm"
          aria-label="Add to collection"
          onClick={onAddClick}
          className="shrink-0 gap-1.5 max-lg:h-11"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      }
    >
      {collectionLabels.some((label) => label.trim()) ? (
        <FoldedChipList items={collectionLabels} label="Collections" />
      ) : (
        <p className={sidebarNoteClass}>Not in a collection</p>
      )}
    </DatasetSidebarSection>
  );
}
