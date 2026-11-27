import type { ReactNode } from "react";
import {
  overviewGutterClass,
  overviewHeadingClass,
} from "../DatasetOverview/DatasetOverview";

/** Muted copy for a section with nothing to list. */
export const sidebarNoteClass = "text-sm leading-6 text-gray-650";

/** A section of the Overview's right column: a title with an action, then its content. */
export default function DatasetSidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`${overviewGutterClass} flex min-w-0 flex-col gap-2 pt-3 pb-4`}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h3 className={overviewHeadingClass}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
