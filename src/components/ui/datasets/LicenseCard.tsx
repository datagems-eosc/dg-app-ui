"use client";

import React from "react";
import { Files } from "lucide-react";

interface LicenseCardProps {
  license: {
    value: string;
    label: string;
    description?: string;
    urls?: string[];
  };
  primaryUrl?: string;
}

export function LicenseCard({ license, primaryUrl }: LicenseCardProps) {
  const urlToOpen = primaryUrl || (license.urls && license.urls[0]);
  return (
    <div className="mt-3 p-5 bg-white rounded-lg border border-slate-200">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <Files strokeWidth={1.25} className="w-5 h-5 text-icon" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-body-14-medium text-gray-750 mb-2">
            {license.label}
          </h4>
          {license.description && (
            <p className="text-descriptions-12-regular tracking-1p text-gray-650">
              {license.description}
            </p>
          )}
          {urlToOpen && (
            <div className="mt-1">
              <button
                type="button"
                className="text-descriptions-12-medium !underline tracking-1p text-blue-850 hover:text-blue-700 cursor-pointer"
                onClick={() =>
                  window.open(
                    urlToOpen as string,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                Read full license
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
