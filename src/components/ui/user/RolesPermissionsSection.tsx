"use client";

import { Chip } from "@ui/Chip";
import { Input } from "@ui/Input";
import { ChevronDown, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import { DatasetPermissionsModal } from "./DatasetPermissionsModal";

type AccessRow = {
  id: string;
  datasetName: string;
  groupsAdded: string;
  uploadedBy: string;
  permissions: string[];
  actions: Array<"edit" | "delete">;
};

const accessRows: AccessRow[] = [
  {
    id: "row-1",
    datasetName: "Hurricane Evacuation Data (2005-2023)",
    groupsAdded: "3",
    uploadedBy: "Beverly Griffin",
    permissions: ["Edit", "+3"],
    actions: ["edit", "delete"],
  },
  {
    id: "row-2",
    datasetName: "Global Surface Air Temperature (1980-2024)",
    groupsAdded: "5",
    uploadedBy: "Jeffery Woods",
    permissions: ["Edit", "+3"],
    actions: [],
  },
  {
    id: "row-3",
    datasetName: "Regional Precipitation Patterns (2010-2024)",
    groupsAdded: "1",
    uploadedBy: "Terry Obrien",
    permissions: ["Edit", "+3"],
    actions: [],
  },
  {
    id: "row-4",
    datasetName: "Coastal Sea Level Rise Projections (2025-2050)",
    groupsAdded: "9",
    uploadedBy: "Ricardo Barnes",
    permissions: ["Edit", "+3"],
    actions: ["edit", "delete"],
  },
  {
    id: "row-5",
    datasetName: "Extreme Weather Events Tracker (2018-2024)",
    groupsAdded: "8",
    uploadedBy: "Evelyn Hayes",
    permissions: ["Edit", "+3"],
    actions: ["edit", "delete"],
  },
];

type DropdownOption = {
  label: string;
  value: string;
};

const showPermissionsOptions: DropdownOption[] = [{ label: "Me", value: "me" }];

const typeOptions: DropdownOption[] = [
  { label: "Datasets", value: "datasets" },
];

const permissionOptions: DropdownOption[] = [
  { label: "Select", value: "all" },
  { label: "Edit", value: "edit" },
];

const defaultGroupOptions: DropdownOption[] = [
  { label: "All groups", value: "all" },
];

function DropdownField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex flex-col gap-1 w-full text-left"
        aria-expanded={isOpen}
      >
        <span className="text-[14px] font-medium leading-[150%] text-gray-750">
          {label}
        </span>
        <span className="flex items-center gap-2 h-10 px-3 rounded-full border border-slate-300 shadow-s1 bg-white text-[14px] text-gray-750">
          <span className="flex-1 truncate">{selected?.label ?? ""}</span>
          <ChevronDown
            className={`w-4 h-4 text-icon transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            strokeWidth={1.25}
          />
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="w-full px-3 py-2 text-left text-[14px] text-gray-750 hover:bg-slate-50"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      <span className="text-[14px] font-medium leading-[150%] text-transparent select-none">
        Search
      </span>
      <Input
        name="roles-search"
        placeholder="Search..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rightIcon={<Search className="w-4 h-4 text-icon" strokeWidth={1.25} />}
        className="h-10"
      />
    </div>
  );
}

export default function RolesPermissionsSection() {
  const api = useApi();
  const [activeDataset, setActiveDataset] = useState<AccessRow | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [showPermissionsFor, setShowPermissionsFor] = useState("me");
  const [typeFilter, setTypeFilter] = useState("datasets");
  const [permissionsFilter, setPermissionsFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupOptions, setGroupOptions] =
    useState<DropdownOption[]>(defaultGroupOptions);

  useEffect(() => {
    if (!api.hasToken) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.queryUserGroups({ like: null });
        if (cancelled) return;
        const options = (result.items ?? [])
          .map((group) => ({
            label: group.name ?? "",
            value: group.id ?? "",
          }))
          .filter((group) => group.label && group.value);
        setGroupOptions([...defaultGroupOptions, ...options]);
      } catch (error) {
        logError("Failed to load groups for filters", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return accessRows.filter((row) => {
      const matchesSearch =
        !query || row.datasetName.toLowerCase().includes(query);
      const matchesPermission =
        permissionsFilter === "all" ||
        row.permissions.some(
          (permission) =>
            permission.toLowerCase() === permissionsFilter.toLowerCase(),
        );
      return matchesSearch && matchesPermission;
    });
  }, [permissionsFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center h-12 border-b border-slate-200">
          <h2 className="text-[16px] font-semibold leading-[150%] text-gray-750">
            User Access
          </h2>
        </div>
        <div className="w-[294px]">
          <DropdownField
            label="Show permissions for"
            value={showPermissionsFor}
            options={showPermissionsOptions}
            onChange={setShowPermissionsFor}
          />
        </div>
        <div className="flex items-center h-12 border-b border-slate-200">
          <h2 className="text-[16px] font-semibold leading-[150%] text-gray-750">
            Filters
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <DropdownField
              label="Type"
              value={typeFilter}
              options={typeOptions}
              onChange={setTypeFilter}
            />
            <DropdownField
              label="Permissions"
              value={permissionsFilter}
              options={permissionOptions}
              onChange={setPermissionsFilter}
            />
            <DropdownField
              label="Group"
              value={groupFilter}
              options={groupOptions}
              onChange={setGroupFilter}
            />
            <SearchField value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="text-[14px] leading-[150%] text-gray-750">
            <span className="text-gray-650">Showing:</span>{" "}
            {filteredRows.length} results
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="min-w-[720px] overflow-x-auto">
            <div className="grid grid-cols-[1fr_126px_180px_122px_137px] bg-slate-50 text-[14px] text-gray-650 border-b border-slate-200">
              <div className="px-4 py-2 font-medium">Dataset name</div>
              <div className="px-4 py-2 font-medium text-center">
                Groups Added
              </div>
              <div className="px-4 py-2 font-medium">Uploaded by</div>
              <div className="px-4 py-2 font-medium">Permissions</div>
              <div className="px-4 py-2 font-medium">Dataset Actions</div>
            </div>
            {filteredRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_126px_180px_122px_137px] items-center h-14 border-b border-slate-200 last:border-b-0"
              >
                <div className="px-4 text-[14px] text-gray-750 truncate">
                  {row.datasetName}
                </div>
                <div className="px-4 flex justify-center">
                  <Chip color="info" variant="outline" size="sm">
                    {row.groupsAdded}
                  </Chip>
                </div>
                <div className="px-4 text-[14px] text-gray-750">
                  {row.uploadedBy}
                </div>
                <div className="px-4 flex gap-2">
                  {row.permissions.map((permission) => (
                    <Chip
                      key={`${row.id}-${permission}`}
                      color="info"
                      variant="outline"
                      size="sm"
                    >
                      {permission}
                    </Chip>
                  ))}
                </div>
                <div className="px-4 flex justify-end gap-2">
                  {row.actions.includes("edit") && (
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center rounded"
                      aria-label={`Edit ${row.datasetName}`}
                      onClick={() => {
                        setActiveDataset(row);
                        setIsPermissionsOpen(true);
                      }}
                    >
                      <Pencil
                        className="w-4 h-4 text-icon"
                        strokeWidth={1.25}
                      />
                    </button>
                  )}
                  {row.actions.includes("delete") && (
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center rounded"
                      aria-label={`Delete ${row.datasetName}`}
                      onClick={() => {
                        setActiveDataset(row);
                        setIsPermissionsOpen(true);
                      }}
                    >
                      <Trash2
                        className="w-4 h-4 text-icon"
                        strokeWidth={1.25}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {activeDataset && (
        <DatasetPermissionsModal
          isOpen={isPermissionsOpen}
          datasetName={activeDataset.datasetName}
          onClose={() => setIsPermissionsOpen(false)}
        />
      )}
    </div>
  );
}
