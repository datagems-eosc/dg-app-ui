"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Globe, Lock } from "lucide-react";

interface VisibilityOption {
  value: "open" | "restricted";
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
}

interface VisibilityCardProps {
  value: "open" | "restricted" | "";
  onChange: (value: "open" | "restricted") => void;
}

const visibilityOptions: VisibilityOption[] = [
  {
    value: "open",
    title: "Open access",
    description: (
      <>
        The dataset will be visible to all users on the platform.{" "}
        <strong>Anyone</strong> can view and access it.
      </>
    ),
    icon: <Globe className="w-5 h-5" />,
  },
  {
    value: "restricted",
    title: "Restricted",
    description: (
      <>
        The dataset will only be visible to you and platform admins. Other users{" "}
        <strong>will not</strong> have access.
      </>
    ),
    icon: <Lock className="w-5 h-5" />,
  },
];

export function VisibilityCard({ value, onChange }: VisibilityCardProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {visibilityOptions.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-start gap-2 p-5 border rounded-lg cursor-pointer transition-colors w-full sm:w-auto",
            value === option.value
              ? "border-blue-850 bg-blue-75"
              : "border-slate-200 hover:border-slate-350 hover:shadow-s2 bg-white"
          )}
        >
          <div className="relative mt-0.5">
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={value === option.value}
              onChange={(e) =>
                onChange(e.target.value as "open" | "restricted")
              }
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 border-1 rounded-full flex items-center justify-center transition-colors",
                value === option.value ? "border-blue-650" : "border-slate-350"
              )}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-blue-650" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-body-14-regular font-medium text-gray-750 mb-1">
              {option.title}
            </h4>
            <p className="w-full sm:w-[85%] text-descriptions-12-regular tracking-1p text-gray-650">
              {option.description}
            </p>
          </div>
        </label>
      ))}
    </div>
  );
}
