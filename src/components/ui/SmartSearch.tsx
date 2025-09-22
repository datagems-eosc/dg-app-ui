"use client";

import React from "react";
import SmartSwitch from "./SmartSwitch";

type SmartSearchProps = {
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  className?: string;
};

export default function SmartSearch({
  enabled = false,
  onToggle,
  className = "",
}: SmartSearchProps) {
  return (
    <div
      className={`w-full mt-4 mb-4 relative bg-[linear-gradient(89.73deg,rgba(199,224,255,0.1)_0.55%,rgba(225,75,255,0.1)_99.7%)] rounded-lg p-[1px] ${className}`}
    >
      <div
        className="absolute inset-0 p-[1px] bg-[linear-gradient(89.73deg,#2187FF_0.55%,#D518FB_99.7%)] rounded-[inherit]"
        style={{
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "xor",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        }}
      />
      <div className="relative px-[12px] pr-[16px] py-[12px] flex items-center justify-between rounded-[inherit]">
        <div className="flex items-center gap-3 min-w-0">
          <SmartSwitch checked={enabled} onChange={onToggle} />
          <div className="flex flex-col min-w-0">
            <span className="text-body-14-medium text-gray-750 truncate">
              Smart search
            </span>
            <span className="text-descriptions-12-regular text-icon tracking-[0.01em] truncate">
              Analyzes dataset contents to help you find what you&apos;re
              looking for
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/wand-sparkles.svg`}
            alt="Smart search"
            className="w-6 h-6"
          />
        </div>
      </div>
    </div>
  );
}
