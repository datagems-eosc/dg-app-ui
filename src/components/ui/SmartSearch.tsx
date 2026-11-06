"use client";

import type React from "react";
import { cn, getBasePath } from "@/lib/utils";
import SmartSwitch from "./SmartSwitch";

// Copy agreed after the 6 November UI call (option A); the label stays
// "Smart search". Keep in step with the search box placeholders in Browse.
const DESCRIPTION_ON =
  "Looks inside the data too. Results can take a few seconds.";
const DESCRIPTION_OFF =
  "Matches your keywords in dataset titles and descriptions.";

const BORDER_MASK: React.CSSProperties = {
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  maskComposite: "xor",
  WebkitMask:
    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
};

type SmartFrameProps = {
  active: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * The Smart search gradient: a tinted fill with a 1px gradient border when
 * active, a neutral grey frame otherwise. Shared by the banner and the search
 * box so both switch together.
 */
export function SmartFrame({ active, className, children }: SmartFrameProps) {
  return (
    <div
      data-smart={active ? "on" : "off"}
      className={cn(
        "relative p-[1px] transition-colors",
        active
          ? "bg-[linear-gradient(89.73deg,rgba(199,224,255,0.1)_0.55%,rgba(225,75,255,0.1)_99.7%)]"
          : "bg-slate-50",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 p-[1px] rounded-[inherit]",
          active
            ? "bg-[linear-gradient(89.73deg,#2187FF_0.55%,#D518FB_99.7%)]"
            : "bg-slate-200",
        )}
        style={BORDER_MASK}
      />
      <div className="relative rounded-[inherit]">{children}</div>
    </div>
  );
}

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
    <SmartFrame
      active={enabled}
      className={cn("w-full mt-4 mb-4 rounded-lg", className)}
    >
      <div className="px-[12px] pr-[16px] py-[12px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <SmartSwitch checked={enabled} onChange={onToggle} />
          <div className="flex flex-col min-w-0">
            <span
              className={cn(
                "text-body-14-medium",
                enabled ? "text-gray-750" : "text-slate-500",
              )}
            >
              Smart search
            </span>
            <span className="text-descriptions-12-regular text-icon tracking-[0.01em]">
              {enabled ? DESCRIPTION_ON : DESCRIPTION_OFF}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <img
            src={`${getBasePath()}/wand-sparkles.svg`}
            alt="Smart search"
            className={cn(
              "w-6 h-6 transition",
              !enabled && "grayscale opacity-50",
            )}
          />
        </div>
      </div>
    </SmartFrame>
  );
}
