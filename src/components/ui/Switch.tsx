import React from "react";

interface SwitchProps {
  leftIcon: React.ComponentType<{ className?: string }>;
  rightIcon: React.ComponentType<{ className?: string }>;
  value: "left" | "right";
  onChange: (value: "left" | "right") => void;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

export default function Switch({
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  value,
  onChange,
  leftLabel,
  rightLabel,
  className = "",
}: SwitchProps) {
  return (
    <div
      className={`flex items-center border border-slate-350 rounded-4xl shadow-s1 overflow-hidden ${className}`}
    >
      <button
        onClick={() => onChange("left")}
        className="flex items-center justify-center pl-1 py-0.75 pr-0 transition-colors"
        title={leftLabel}
      >
        <div
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            value === "left"
              ? "bg-slate-100 text-blue-800"
              : "text-gray-600 hover:bg-slate-75"
          }`}
        >
          <LeftIcon
            className={`w-4 h-4 ${value === "left" ? "text-gray-750" : "text-slate-450"}`}
          />
        </div>
        {leftLabel && <span className="text-body-14-medium">{leftLabel}</span>}
      </button>
      <button
        onClick={() => onChange("right")}
        className="flex items-center justify-center pr-1 py-0.75 pl-0 transition-colors"
        title={rightLabel}
      >
        <div
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            value === "right"
              ? "bg-slate-100 text-blue-800"
              : "text-gray-600 hover:bg-slate-75"
          }`}
        >
          <RightIcon
            className={`w-4 h-4 ${value === "right" ? "text-gray-750" : "text-slate-450"}`}
          />
        </div>
        {rightLabel && (
          <span className="text-body-14-medium">{rightLabel}</span>
        )}
      </button>
    </div>
  );
}
