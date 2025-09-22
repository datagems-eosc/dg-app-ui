import React from "react";
import { Chip } from "./Chip";

interface SmartSearchMatchItemProps {
  number: number;
  description: string;
  matchPercentage: number;
  isLast?: boolean;
}

export function SmartSearchMatchItem({
  number,
  description,
  matchPercentage,
  isLast,
}: SmartSearchMatchItemProps) {
  return (
    <div className="flex items-start gap-4 px-4 pt-4">
      {/* Number in circle */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full border border-slate-350 flex items-center justify-center">
        <span className="text-descriptions-12-medium text-gray-750">
          {number}
        </span>
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 ${!isLast ? "border-b border-slate-100" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-body-14-regular text-gray-650 flex-1 pb-4">
            {description}
          </p>
          <Chip color="success" size="xs" className="flex-shrink-0">
            {matchPercentage}% match
          </Chip>
        </div>
      </div>
    </div>
  );
}
