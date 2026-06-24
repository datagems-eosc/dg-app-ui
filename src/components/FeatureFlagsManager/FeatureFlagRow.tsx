"use client";

import SmartSwitch from "@ui/SmartSwitch";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

interface FeatureFlagRowProps {
  label: string;
  value: boolean;
  onSave: (next: boolean) => void;
}

export function FeatureFlagRow({ label, value, onSave }: FeatureFlagRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const cancel = () => setIsEditing(false);

  const save = () => {
    onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-4 border-b border-[#e5e9ef] px-5 py-4 last:border-b-0">
      <span className="flex-1 text-body-16-regular text-gray-750">{label}</span>

      <div className="flex w-[120px] items-center">
        <SmartSwitch
          checked={isEditing ? draft : value}
          onChange={setDraft}
          disabled={!isEditing}
          ariaLabel={label}
        />
      </div>

      <div className="flex w-[88px] items-center justify-end gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              aria-label={`Save ${label}`}
              onClick={save}
              className="flex size-8 items-center justify-center rounded-md bg-[#2b7fff] text-white transition-colors hover:bg-[#1d6ff0]"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Cancel ${label}`}
              onClick={cancel}
              className="flex size-8 items-center justify-center rounded-md bg-[#e5e9ef] text-gray-750 transition-colors hover:bg-[#d7dde6]"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={startEditing}
            className="flex size-8 items-center justify-center rounded-md border border-[#e5e9ef] bg-white text-gray-750 transition-colors hover:bg-slate-50"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
