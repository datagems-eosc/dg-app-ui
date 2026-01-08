"use client";

import { CalendarPlus, FileCheck, HardDrive, RefreshCcw } from "lucide-react";
import React from "react";
import type { DatasetPlus } from "@/data/dataset";
import { formatDate, formatFileSize, getMimeTypeName } from "@/lib/utils";
import styles from "./DatasetMetadataBar.module.scss";

interface DatasetMetadataBarProps {
  dataset: DatasetPlus;
}

interface MetadataItem {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export default function DatasetMetadataBar({
  dataset,
}: DatasetMetadataBarProps) {
  const items: MetadataItem[] = [
    {
      icon: <CalendarPlus className={styles.datasetMetadataBar__icon} />,
      label: "Added",
      value: formatDate(dataset.datePublished) || "2023-04-01",
    },
    {
      icon: <RefreshCcw className={styles.datasetMetadataBar__icon} />,
      label: "Last updated",
      value: formatDate(dataset.lastUpdated) || "2023-04-01",
    },
    {
      icon: <HardDrive className={styles.datasetMetadataBar__icon} />,
      label: "File Size",
      value: dataset.size ? formatFileSize(dataset.size) : "2.4 GB",
    },
    {
      icon: <FileCheck className={styles.datasetMetadataBar__icon} />,
      label: "File Type",
      value: dataset.mimeType
        ? getMimeTypeName(dataset.mimeType).toUpperCase()
        : "CSV, PDF",
    },
  ];

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
