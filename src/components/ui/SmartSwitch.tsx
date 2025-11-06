"use client";

import React from "react";

type SmartSwitchProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
};

export default function SmartSwitch({
  checked,
  onChange,
  className = "",
  disabled = false,
}: SmartSwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState<boolean>(
    !!checked,
  );

  const isControlled = typeof checked === "boolean";
  const isOn = isControlled ? !!checked : internalChecked;

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
      aria-label="Smart search switch"
      onClick={handleToggle}
      disabled={disabled}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out w-[44px] h-[24px] focus:outline-none ${
        isOn ? "bg-sky-950" : "bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <span
        className={`inline-block rounded-full bg-white transition-transform duration-200 ease-in-out w-[20px] h-[20px] translate-x-[2px] ${
          isOn ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
