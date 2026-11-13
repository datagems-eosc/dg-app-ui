"use client";

import { CalendarPlus, FileCheck, HardDrive } from "lucide-react";
import React from "react";
import type { DatasetPlus } from "@/data/dataset";
import {
  type DatasetProfileMetadata,
  deriveProfileMetadata,
} from "@/lib/datasetProfileMetadata";
import { formatDate, formatFileSize } from "@/lib/utils";
import styles from "./DatasetMetadataBar.module.scss";

interface DatasetMetadataBarProps {
  dataset: DatasetPlus;
  metadata?: DatasetProfileMetadata;
}

interface MetadataItem {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}

export default function DatasetMetadataBar({
  dataset,
  metadata = deriveProfileMetadata(dataset.profileRaw),
}: DatasetMetadataBarProps) {
  const suppliedDate = (value?: string) => {
    const formatted = formatDate(value);
    return formatted === "-" ? undefined : formatted;
  };
  const items: MetadataItem[] = [
    {
      icon: <CalendarPlus className={styles.datasetMetadataBar__icon} />,
      label: "Added",
      value: suppliedDate(dataset.datePublished),
    },
    {
      icon: <HardDrive className={styles.datasetMetadataBar__icon} />,
      label: "File size",
      value:
        metadata.size.kind === "unavailable"
          ? undefined
          : formatFileSize(metadata.size.bytes),
    },
    {
      icon: <FileCheck className={styles.datasetMetadataBar__icon} />,
      label: "File Type",
      value: metadata.formats.length ? metadata.formats.join(", ") : undefined,
    },
  ].filter((item) => item.value !== undefined);

  if (!items.length) return null;

  return (
    <div className={styles.datasetMetadataBar}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <div className={styles.datasetMetadataBar__separator} />
          )}
          <div className={styles.datasetMetadataBar__item}>
            {item.icon}
            <div className={styles.datasetMetadataBar__content}>
              <span className={styles.datasetMetadataBar__label}>
                {item.label}
              </span>
              <span className={styles.datasetMetadataBar__value}>
                {item.value}
              </span>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
