"use client";

import { Button } from "@ui/Button";
import { Checkbox } from "@ui/Checkbox";
import { Chip } from "@ui/Chip";
import { Input } from "@ui/Input";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type GroupItem = {
  id: string;
  name: string;
};

const groups: GroupItem[] = [
  { id: "administrators", name: "Administrators" },
  { id: "analytics", name: "Analytics Team" },
  { id: "engineering", name: "Engineering Team" },
  { id: "finance", name: "Finance Team" },
  { id: "moderators", name: "Moderators" },
  { id: "mobile", name: "Mobile Team" },
  { id: "researchers", name: "Researchers" },
];

interface ManageGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ManageGroupsModal({
  isOpen,
  onClose,
  onSave,
}: ManageGroupsModalProps) {
  const [search, setSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([
    "analytics",
    "engineering",
    "finance",
    "moderators",
    "researchers",
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-[0px_4px_10px_0px_rgba(29,41,61,0.1)] w-full max-w-[960px] h-[744px] max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Manage Groups"
      >
        <div className="flex items-center h-[72px] px-6 pr-4 border-b border-slate-200">
          <h2 className="text-[18px] font-semibold leading-[140%] text-slate-850 flex-1">
            Manage Groups
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-icon" strokeWidth={1.25} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-6">
          <div className="text-[16px] font-semibold leading-[150%] text-gray-750 mb-4">
            Groups
          </div>
          <Input
            name="manage-groups-search"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            icon={<Search className="w-4 h-4 text-icon" strokeWidth={1.25} />}
            className="h-10"
          />

          <div className="mt-4 border-t border-slate-200">
            {visibleGroups.map((group) => {
              const isSelected = selectedGroups.includes(group.id);
              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between h-[72px] border-b border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={isSelected}
                      onChange={(checked) => {
                        setSelectedGroups((prev) =>
                          checked
                            ? [...prev, group.id]
                            : prev.filter((id) => id !== group.id),
                        );
                      }}
                    />
                    <span className="text-[14px] font-medium text-slate-850">
                      {group.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Chip
                      variant="regular"
                      color="info"
                      size="xs"
                      className="bg-blue-50 border-blue-50 text-blue-800"
                    >
                      Added
                    </Chip>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="rounded-full w-[148px]"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onSave}
            className="rounded-full w-[148px]"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
