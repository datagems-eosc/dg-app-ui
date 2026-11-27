"use client";

import {
  CalendarPlus,
  FileCheck,
  Files,
  HardDrive,
  type LucideIcon,
  Table2,
} from "lucide-react";
import type { DatasetPlus } from "@/data/dataset";
import {
  type DatasetProfileMetadata,
  deriveProfileMetadata,
} from "@/lib/datasetProfileMetadata";
import { formatDate, formatFileSize } from "@/lib/utils";
import { DATASET_CONTENTS_ID } from "../datasetContentsAnchor";

interface DatasetMetadataBarProps {
  dataset: DatasetPlus;
  metadata?: DatasetProfileMetadata;
}

interface Fact {
  icon: LucideIcon;
  label: string;
  value?: string;
  /** A count that leads to the dataset contents. */
  count?: { value: number; one: string; many: string };
}

function goToContents() {
  const node = document.getElementById(DATASET_CONTENTS_ID);
  node?.scrollIntoView({ block: "start", behavior: "smooth" });
  node?.focus({ preventScroll: true });
}

function countFact(
  icon: LucideIcon,
  value: number,
  one: string,
  many: string,
): Fact[] {
  if (value <= 0) return [];
  const label = value === 1 ? one : many;
  return [
    {
      icon,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      count: { value, one, many },
    },
  ];
}

/** Added, Size, Format and the number of files or tables; absent facts are left out. */
export default function DatasetMetadataBar({
  dataset,
  metadata = deriveProfileMetadata(dataset.profileRaw),
}: DatasetMetadataBarProps) {
  const added = formatDate(dataset.datePublished);
  const facts: Fact[] = [
    {
      icon: CalendarPlus,
      label: "Added",
      value: added === "-" ? undefined : added,
    },
    {
      icon: HardDrive,
      label: "Size",
      value:
        metadata.size.kind === "unavailable"
          ? undefined
          : formatFileSize(metadata.size.bytes),
    },
    {
      icon: FileCheck,
      label: metadata.formats.length > 1 ? "Formats" : "Format",
      value: metadata.formats.join(", ") || undefined,
    },
  ].filter((fact) => fact.value !== undefined);
  facts.push(
    ...countFact(Files, metadata.fileCount, "file", "files"),
    ...countFact(Table2, metadata.tableCount, "table", "tables"),
  );

  if (!facts.length) return null;

  return (
    <dl className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5">
      {facts.map(({ icon: Icon, label, value, count }) => (
        <div key={label} className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-icon" />
          <dt className="text-gray-650">{label}</dt>
          <dd className="min-w-0 font-medium text-gray-750 [overflow-wrap:anywhere]">
            {count ? (
              <button
                type="button"
                aria-label={`${count.value.toLocaleString("en-US")} ${
                  count.value === 1 ? count.one : count.many
                }, go to Inside this dataset`}
                onClick={goToContents}
                className="relative cursor-pointer rounded-sm underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-850 max-lg:after:absolute max-lg:after:-inset-3"
              >
                {count.value.toLocaleString("en-US")}
              </button>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
