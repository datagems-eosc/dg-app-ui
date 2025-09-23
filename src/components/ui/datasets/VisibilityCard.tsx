"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Globe, Lock } from "lucide-react";

interface VisibilityOption {
  value: "open" | "restricted";
  title: string;
  description: string;
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
    description: "The dataset will be visible to all users on the platform. Anyone can view and access it.",
    icon: <Globe className="w-5 h-5" />
  },
  {
    value: "restricted",
    title: "Restricted",
    description: "The dataset will only be visible to you and platform admins. Other users will not have access.",
    icon: <Lock className="w-5 h-5" />
  }
];

export function VisibilityCard({ value, onChange }: VisibilityCardProps) {
  return (
    <div className="space-y-3">
      {visibilityOptions.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors",
            value === option.value
              ? "border-blue-600 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          )}
        >
          <div className="relative mt-0.5">
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value as "open" | "restricted")}
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 border-1 rounded-full flex items-center justify-center transition-colors",
                value === option.value
                  ? "border-blue-650"
                  : "border-slate-350"
              )}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-blue-650" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "text-slate-600",
                value === option.value && "text-blue-600"
              )}>
                {option.icon}
              </div>
              <h4 className="text-sm font-medium text-slate-850">
                {option.title}
              </h4>
            </div>
            <p className="text-sm text-slate-600">
              {option.description}
            </p>
          </div>
        </label>
      ))}
    </div>
  );
}
