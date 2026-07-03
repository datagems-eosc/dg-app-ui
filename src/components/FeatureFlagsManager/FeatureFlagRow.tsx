"use client";

import SmartSwitch from "@ui/SmartSwitch";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

interface FeatureFlagRowProps {
  label: string;
  value: boolean;
  onSave: (next: boolean) => void;
  datasetId?: string | null;
  onSaveDatasetId?: (value: string) => void;
}

export function FeatureFlagRow({
  label,
  value,
  onSave,
  datasetId,
  onSaveDatasetId,
}: FeatureFlagRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [datasetIdDraft, setDatasetIdDraft] = useState(datasetId ?? "");

  const startEditing = () => {
    setDraft(value);
    setDatasetIdDraft(datasetId ?? "");
    setIsEditing(true);
  };

  const cancel = () => setIsEditing(false);

  const save = () => {
    onSave(draft);
    if (onSaveDatasetId) onSaveDatasetId(datasetIdDraft);
    setIsEditing(false);
  };

  const hasDatasetId = onSaveDatasetId !== undefined;

  return (
    <div className="flex flex-col border-b border-[#e5e9ef] px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-4">
        <span className="flex-1 text-body-16-regular text-gray-750">
          {label}
        </span>

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

      {hasDatasetId && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-body-14-regular text-[#566b88] shrink-0">
            Dataset Id:
          </span>
          <input
            type="text"
            value={isEditing ? datasetIdDraft : (datasetId ?? "")}
            onChange={(e) => setDatasetIdDraft(e.target.value)}
            disabled={!isEditing}
            aria-label={`Dataset ID for ${label}`}
            placeholder="Enter dataset ID"
            className="flex-1 rounded-md border border-[#e5e9ef] bg-white px-3 py-1.5 text-body-14-regular text-gray-750 placeholder:text-[#8095ad] outline-none transition-colors disabled:bg-[#f8f9fb] disabled:text-[#8095ad] focus:border-[#2b7fff]"
          />
        </div>
      )}
    </div>
  );
}
