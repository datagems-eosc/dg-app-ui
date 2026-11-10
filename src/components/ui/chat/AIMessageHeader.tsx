"use client";

import DGIcon from "./DGIcon";

export function AIMessageHeader() {
  return (
    <div className="flex items-center gap-2">
      <DGIcon size={20} aria-hidden="true" className="shrink-0" />
      <span className="text-body-14-medium text-slate-850">DataGEMS</span>
    </div>
  );
}
