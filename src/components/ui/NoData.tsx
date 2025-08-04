import React from "react";
import { LucideIcon } from "lucide-react";

interface NoDataProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function NoData({
  icon: Icon,
  title,
  description,
  className = "",
}: NoDataProps) {
  return (
    <div
      className={`flex flex-col gap-1 p-3 rounded-lg bg-slate-75 items-center justify-center ${className}`}
    >
      <Icon className="w-6 h-6 text-slate-350 mb-1" />
      <span className="text-body-14-medium text-gray-750">{title}</span>
      {description && (
        <span className="text-descriptions-12-regular tracking-1p text-gray-650">
          {description}
        </span>
      )}
    </div>
  );
}
