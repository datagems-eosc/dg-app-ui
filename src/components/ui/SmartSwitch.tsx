"use client";

import React from "react";

type SmartSwitchProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
};

export default function SmartSwitch({
  checked,
  onChange,
  className = "",
  disabled = false,
  ariaLabel = "Smart search switch",
  size = "md",
}: SmartSwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState<boolean>(
    !!checked,
  );

  const isControlled = typeof checked === "boolean";
  const isOn = isControlled ? !!checked : internalChecked;

  const dimensions =
    size === "sm"
      ? {
          track: "w-[30px] h-[16px]",
          knob: "w-[12px] h-[12px]",
          knobOff: "translate-x-[2px]",
          knobOn: "translate-x-[16px]",
        }
      : {
          track: "w-[44px] h-[24px]",
          knob: "w-[20px] h-[20px]",
          knobOff: "translate-x-[2px]",
          knobOn: "translate-x-[22px]",
        };

  const handleToggle = () => {
    if (disabled) return;
    const next = !isOn;
    if (!isControlled) setInternalChecked(next);
    onChange?.(next);
  };

  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={ariaLabel}
      onClick={handleToggle}
      disabled={disabled}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out ${dimensions.track} focus:outline-none ${
        isOn ? "bg-sky-950" : "bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <span
        className={`inline-block rounded-full bg-white transition-transform duration-200 ease-in-out ${dimensions.knob} ${dimensions.knobOff} ${
          isOn ? dimensions.knobOn : dimensions.knobOff
        }`}
      />
    </button>
  );
}
