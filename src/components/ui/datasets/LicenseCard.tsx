"use client";

import React from "react";

interface LicenseCardProps {
  license: {
    value: string;
    label: string;
    description?: string;
  };
}

export function LicenseCard({ license }: LicenseCardProps) {
  if (!license.description) return null;

  return (
    <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h4 className="text-sm font-medium text-slate-850 mb-2">
        {license.label}
      </h4>
      <p className="text-sm text-slate-600">
        {license.description}
      </p>
    </div>
  );
}
