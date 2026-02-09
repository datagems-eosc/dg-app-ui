"use client";

import { Checkbox } from "@ui/Checkbox";
import { Chip } from "@ui/Chip";
import { Input } from "@ui/Input";
import { ChevronDown, Pencil, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatasetPermissionsModal } from "@/components/ui/user/DatasetPermissionsModal";
import { useApi } from "@/hooks/useApi";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { logError, logWarn } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import type { ContextGrant } from "@/types/contextGrants";
import type { UserGroupQueryResult } from "@/types/userDirectory";
import styles from "./RolesPermissionsSection.module.scss";

type DropdownOption = {
  label: string;
  value: string;
};

type GrantRow = {
  id: string;
  targetId: string;
  targetName: string;
  targetType: string;
  roles: string[];
  groupCount: number;
  groupIds: string[];
};

const TARGET_KIND_LABELS: Record<number, string> = {
  0: "Dataset",
  1: "Collection",
};

const PERMISSION_LABELS: Record<string, string> = {
  browse: "Browse",
  delete: "Delete",
  download: "Download",
  edit: "Edit",
  manage: "Manage",
  search: "Search",
};

const ROLE_LABEL_MAP: Record<string, string> = {
  "dg_ds-browse": PERMISSION_LABELS.browse,
  "dg_ds-delete": PERMISSION_LABELS.delete,
  "dg_ds-download": PERMISSION_LABELS.download,
  "dg_ds-edit": PERMISSION_LABELS.edit,
  "dg_ds-manage": PERMISSION_LABELS.manage,
  "dg_ds-search": PERMISSION_LABELS.search,
  "dg_col-browse": PERMISSION_LABELS.browse,
  "dg_col-delete": PERMISSION_LABELS.delete,
  "dg_col-download": PERMISSION_LABELS.download,
  "dg_col-edit": PERMISSION_LABELS.edit,
  "dg_col-manage": PERMISSION_LABELS.manage,
  "dg_col-search": PERMISSION_LABELS.search,
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as Array<
  keyof typeof PERMISSION_LABELS
>;

const getRoleLabel = (role?: string | null) => {
  const normalized = role?.trim().toLowerCase() ?? "";
  if (ROLE_LABEL_MAP[normalized]) return ROLE_LABEL_MAP[normalized];
  if (!normalized) return "Unknown";
  const matchedKey = PERMISSION_KEYS.find((key) => normalized.includes(key));
  if (matchedKey) return PERMISSION_LABELS[matchedKey];
  return role?.trim() || "Unknown";
};

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
        <span className="text-[14px] font-semibold leading-[150%] text-gray-750">
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

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
  withSearch = false,
  showSelectAll = true,
  triggerClassName,
}: {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  withSearch?: boolean;
  showSelectAll?: boolean;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const filteredOptions = searchTerm
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : options;

  const filteredValues = useMemo(
    () => filteredOptions.map((option) => option.value),
    [filteredOptions],
  );
  const allSelected =
    filteredValues.length > 0 &&
    filteredValues.every((value) => selected.includes(value));

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const toggleSelectAll = () => {
    if (filteredValues.length === 0) return;
    if (allSelected) {
      onChange(selected.filter((value) => !filteredValues.includes(value)));
    } else {
      onChange(Array.from(new Set([...selected, ...filteredValues])));
    }
  };

  const displayValue =
    selected.length === 0 ? placeholder : `${selected.length} selected`;

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
          <span className="flex-1 truncate">{displayValue}</span>
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
          {withSearch && (
            <div className="p-2 border-b border-slate-200">
              <Input
                name={`${label}-search`}
                placeholder="Search..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                rightIcon={
                  <Search className="w-4 h-4 text-icon" strokeWidth={1.25} />
                }
                className="h-9"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-2">
            {showSelectAll && (
              <div className="px-3 py-2 hover:bg-slate-50">
                <Checkbox
                  id={`${label}-select-all`}
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  label="Select All"
                />
              </div>
            )}
            {filteredOptions.map((option) => (
              <div key={option.value} className="px-3 py-2 hover:bg-slate-50">
                <Checkbox
                  id={`${label}-${option.value}`}
                  checked={selected.includes(option.value)}
                  onChange={() => toggleOption(option.value)}
                  label={option.label}
                />
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-[14px] text-gray-650">
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeDropdown({
  label,
  value,
  groups,
  onChange,
  triggerClassName,
}: {
  label: string;
  value: string;
  groups: DropdownOption[];
  onChange: (value: string) => void;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const filteredGroups = searchTerm
    ? groups.filter((group) =>
        group.label.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : groups;

  const selected =
    value === "me"
      ? "Me"
      : (groups.find((group) => group.value === value)?.label ?? "Me");

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
        <span
          className={`flex items-center gap-2 h-10 px-3 rounded-full border border-slate-300 shadow-s1 bg-white text-[14px] text-gray-750 ${triggerClassName ?? ""}`}
        >
          <span className="flex-1 truncate">{selected}</span>
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
          <div className="p-2 border-b border-slate-200">
            <Input
              name="scope-search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              rightIcon={
                <Search className="w-4 h-4 text-icon" strokeWidth={1.25} />
              }
              className="h-9"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-2">
            <div className="px-3 py-1 text-[12px] uppercase text-gray-500">
              Me
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("me");
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-[14px] text-gray-750 hover:bg-slate-50"
            >
              Me
            </button>
            <div className="px-3 py-1 text-[12px] uppercase text-gray-500">
              Groups
            </div>
            {filteredGroups.map((group) => (
              <button
                key={group.value}
                type="button"
                onClick={() => {
                  onChange(group.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[14px] text-gray-750 hover:bg-slate-50"
              >
                {group.label}
              </button>
            ))}
            {filteredGroups.length === 0 && (
              <div className="px-3 py-2 text-[14px] text-gray-650">
                No groups found
              </div>
            )}
            <div className="px-3 py-1 text-[12px] uppercase text-gray-500">
              Users
            </div>
            <div className="px-3 py-2 text-[14px] text-gray-650">
              No users found
            </div>
          </div>
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
  const router = useRouter();
  const {
    hasToken,
    getCurrentUserContextGrants,
    queryUserGroups,
    queryDatasets,
    queryCollections,
  } = api;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [grants, setGrants] = useState<ContextGrant[]>([]);
  const [datasetNames, setDatasetNames] = useState<Record<string, string>>({});
  const [collectionNames, setCollectionNames] = useState<
    Record<string, string>
  >({});
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState("datasets");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [principalScope, setPrincipalScope] = useState("me");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!hasToken) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    const loadGrants = async () => {
      try {
        const grantsResult = await getCurrentUserContextGrants();
        if (cancelled) return;
        setGrants(grantsResult);
        let groupsResult: UserGroupQueryResult = { items: [] };
        try {
          groupsResult = await queryUserGroups({ like: null });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logWarn("Failed to load user groups for grants", {
            error: errorMessage,
          });
        }
        const groupMap = (groupsResult.items ?? [])
          .map((group) => ({
            id: group.id ?? "",
            name: group.name ?? "",
          }))
          .filter((group) => group.id && group.name)
          .reduce<Record<string, string>>((acc, group) => {
            acc[group.id] = group.name;
            return acc;
          }, {});
        setGroupNames(groupMap);

        const datasetIds = grantsResult
          .filter((grant) => grant.targetType === 0 && grant.targetId)
          .map((grant) => grant.targetId as string);
        const collectionIds = grantsResult
          .filter((grant) => grant.targetType === 1 && grant.targetId)
          .map((grant) => grant.targetId as string);

        const [datasetsResult, collectionsResult] = await Promise.all([
          datasetIds.length > 0
            ? queryDatasets({
                ids: datasetIds,
                project: { fields: ["id", "name"] },
                page: { Offset: 0, Size: datasetIds.length },
                Order: { Items: ["+name"] },
                Metadata: { CountAll: false },
              }).catch((error) => {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                logWarn("Failed to load dataset names for grants", {
                  error: errorMessage,
                });
                return { items: [] };
              })
            : Promise.resolve({ items: [] }),
          collectionIds.length > 0
            ? queryCollections({
                ids: collectionIds,
                project: { fields: ["id", "name"] },
                page: { Offset: 0, Size: collectionIds.length },
                Order: { Items: ["+name"] },
                Metadata: { CountAll: false },
              }).catch((error) => {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                logWarn("Failed to load collection names for grants", {
                  error: errorMessage,
                });
                return { items: [] };
              })
            : Promise.resolve({ items: [] }),
        ]);

        if (cancelled) return;

        const datasetItems = (datasetsResult.items ?? []) as Array<{
          id?: string;
          name?: string;
        }>;
        const datasetMap = datasetItems
          .map((item) => ({
            id: item.id ?? "",
            name: item.name ?? "",
          }))
          .filter((item) => item.id && item.name)
          .reduce((acc: Record<string, string>, item) => {
            acc[item.id] = item.name;
            return acc;
          }, {});
        const collectionItems = (collectionsResult.items ?? []) as Array<{
          id?: string;
          name?: string;
        }>;
        const collectionMap = collectionItems
          .map((item) => ({
            id: item.id ?? "",
            name: item.name ?? "",
          }))
          .filter((item) => item.id && item.name)
          .reduce((acc: Record<string, string>, item) => {
            acc[item.id] = item.name;
            return acc;
          }, {});

        setDatasetNames(datasetMap);
        setCollectionNames(collectionMap);
      } catch (error) {
        if (cancelled) return;
        logError("Failed to load context grants", error);
        setErrorMessage(ApiErrorMessage.FETCH_GRANTS_FAILED);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadGrants();

    return () => {
      cancelled = true;
    };
  }, [
    getCurrentUserContextGrants,
    hasToken,
    queryCollections,
    queryDatasets,
    queryUserGroups,
  ]);

  const rows = useMemo<GrantRow[]>(() => {
    const scopedGrants =
      principalScope === "me"
        ? grants
        : grants.filter(
            (grant) =>
              grant.principalType === 1 && grant.principalId === principalScope,
          );
    const grouped = new Map<
      string,
      {
        targetId: string;
        targetType: number;
        roles: Set<string>;
        groups: Set<string>;
      }
    >();

    scopedGrants.forEach((grant) => {
      if (grant.targetType === null || grant.targetType === undefined) return;
      if (!grant.targetId) return;
      const key = `${grant.targetType}:${grant.targetId}`;
      const entry = grouped.get(key) ?? {
        targetId: grant.targetId,
        targetType: grant.targetType,
        roles: new Set<string>(),
        groups: new Set<string>(),
      };
      if (grant.role?.trim()) {
        entry.roles.add(getRoleLabel(grant.role));
      }
      if (grant.principalType === 1 && grant.principalId) {
        entry.groups.add(grant.principalId);
      }
      grouped.set(key, entry);
    });

    return Array.from(grouped.values()).map((entry) => {
      const targetName =
        entry.targetType === 0
          ? datasetNames[entry.targetId] || entry.targetId || "Unknown"
          : entry.targetType === 1
            ? collectionNames[entry.targetId] || entry.targetId || "Unknown"
            : entry.targetId || "Unknown";

      return {
        id: `${entry.targetType}-${entry.targetId}`,
        targetId: entry.targetId,
        targetName,
        targetType: TARGET_KIND_LABELS[entry.targetType] ?? "Unknown",
        roles: Array.from(entry.roles),
        groupCount: entry.groups.size,
        groupIds: Array.from(entry.groups),
      };
    });
  }, [collectionNames, datasetNames, grants, principalScope]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType =
        typeFilter === "datasets"
          ? row.targetType.toLowerCase() === "dataset"
          : row.targetType.toLowerCase() === "collection";
      const matchesRole =
        roleFilter.length === 0 ||
        roleFilter.some((role) => row.roles.includes(role));
      const matchesGroup =
        groupFilter.length === 0 ||
        row.groupIds.some((groupId) => groupFilter.includes(groupId));
      const matchesSearch =
        !query || row.targetName.toLowerCase().includes(query);
      return matchesType && matchesRole && matchesGroup && matchesSearch;
    });
  }, [grants, groupFilter, roleFilter, rows, searchQuery, typeFilter]);

  const typeOptions: DropdownOption[] = [
    { label: "Datasets", value: "datasets" },
    { label: "Collections", value: "collections" },
  ];

  const myGroups = useMemo(
    () =>
      Object.entries(groupNames).map(([id, name]) => ({
        id,
        name,
      })),
    [groupNames],
  );

  const groupOptions: DropdownOption[] = myGroups.map((group) => ({
    label: group.name,
    value: group.id,
  }));

  const scopeOptions: DropdownOption[] = [
    { label: "Me", value: "me" },
    ...myGroups.map((group) => ({ label: group.name, value: group.id })),
  ];

  const permissionOptions = useMemo<DropdownOption[]>(() => {
    const baseOptions = PERMISSION_KEYS.map((key) => ({
      label: PERMISSION_LABELS[key],
      value: PERMISSION_LABELS[key],
    }));
    const extraLabels = Array.from(
      new Set(
        grants
          .map((grant) => getRoleLabel(grant.role))
          .filter(
            (label) =>
              label !== "Unknown" &&
              !baseOptions.some((option) => option.value === label),
          ),
      ),
    );
    return [
      ...baseOptions,
      ...extraLabels.map((label) => ({ label, value: label })),
    ];
  }, [grants]);

  const selectedGroupLabels = useMemo(
    () =>
      groupFilter.map(
        (groupId) =>
          groupOptions.find((option) => option.value === groupId)?.label ??
          groupId,
      ),
    [groupFilter, groupOptions],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center h-12 border-b border-slate-200">
          <h2 className="text-[16px] font-semibold leading-[150%] text-gray-750">
            User Access
          </h2>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <div className="w-full lg:w-1/2">
            <ScopeDropdown
              label="Show permissions for"
              value={principalScope}
              groups={scopeOptions.filter((option) => option.value !== "me")}
              onChange={setPrincipalScope}
              triggerClassName={styles.showPermissionsSelect}
            />
          </div>
          <div className="flex w-full flex-col gap-1 lg:w-1/2">
            <span className="text-[14px] font-semibold leading-[150%] text-gray-750">
              My groups
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {myGroups.slice(0, 4).map((group) => (
                <span
                  key={group.id}
                  className="px-3 py-1 rounded-full bg-slate-100 text-[12px] text-gray-750"
                >
                  {group.name}
                </span>
              ))}
              {myGroups.length > 4 && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-[12px] text-gray-750">
                  +{myGroups.length - 4}
                </span>
              )}
            </div>
          </div>
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
            <MultiSelectDropdown
              label="Permissions"
              placeholder="Select"
              options={permissionOptions}
              selected={roleFilter}
              onChange={setRoleFilter}
            />
            <MultiSelectDropdown
              label="Group"
              placeholder="All groups"
              options={groupOptions}
              selected={groupFilter}
              onChange={setGroupFilter}
            />
            <SearchField value={searchQuery} onChange={setSearchQuery} />
          </div>
          {(roleFilter.length > 0 || groupFilter.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {roleFilter.map((role) => (
                <Chip
                  key={`permission-${role}`}
                  color="grey"
                  size="sm"
                  onRemove={() =>
                    setRoleFilter((prev) =>
                      prev.filter((value) => value !== role),
                    )
                  }
                >
                  Permission: {role}
                </Chip>
              ))}
              {selectedGroupLabels.map((groupLabel, index) => (
                <Chip
                  key={`group-${groupFilter[index] ?? groupLabel}`}
                  color="grey"
                  size="sm"
                  onRemove={() => {
                    const groupId = groupFilter[index];
                    if (!groupId) return;
                    setGroupFilter((prev) =>
                      prev.filter((value) => value !== groupId),
                    );
                  }}
                >
                  Group: {groupLabel}
                </Chip>
              ))}
            </div>
          )}
          <div className="text-[14px] leading-[150%] text-gray-750">
            <span className="text-gray-650">Showing:</span>{" "}
            {filteredRows.length} results
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="min-w-[880px] overflow-x-auto">
            <div className="grid grid-cols-[1.5fr_120px_160px_200px_120px] bg-slate-50 text-[14px] text-gray-650 border-b border-slate-200">
              <div className="px-4 py-2 font-medium">
                {typeFilter === "collections"
                  ? "Collection name"
                  : "Dataset name"}
              </div>
              <div className="px-4 py-2 font-medium text-center">
                Groups Added
              </div>
              <div className="px-4 py-2 font-medium">Uploaded by</div>
              <div className="px-4 py-2 font-medium">Permissions</div>
              <div className="px-4 py-2 font-medium text-center">
                Dataset Actions
              </div>
            </div>
            {isLoading && (
              <div className="px-4 py-6 text-[14px] text-gray-650">
                Loading access entries...
              </div>
            )}
            {!isLoading && errorMessage && (
              <div className="px-4 py-6 text-[14px] text-gray-650">
                {errorMessage}
              </div>
            )}
            {!isLoading && !errorMessage && filteredRows.length === 0 && (
              <div className="px-4 py-6 text-[14px] text-gray-650">
                No access entries found
              </div>
            )}
            {!isLoading &&
              !errorMessage &&
              filteredRows.map((row) => {
                const roles = row.roles;
                const primaryRole = roles[0];
                const extraCount = Math.max(roles.length - 1, 0);
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1.5fr_120px_160px_200px_120px] items-center h-12 border-b border-slate-200 last:border-b-0"
                  >
                    <div className="px-4 text-[14px] text-gray-750 truncate">
                      {row.targetType.toLowerCase() === "dataset" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDataset({
                              id: row.targetId,
                              name: row.targetName,
                            })
                          }
                          className="text-left hover:underline"
                        >
                          {row.targetName}
                        </button>
                      ) : (
                        row.targetName
                      )}
                    </div>
                    <div className="px-4 flex items-center justify-center">
                      <Chip color="grey" size="xs">
                        {row.groupCount}
                      </Chip>
                    </div>
                    <div className="px-4 text-[14px] text-gray-750">—</div>
                    <div className="px-4 flex items-center gap-2">
                      {primaryRole && (
                        <Chip color="info" variant="outline" size="sm">
                          {primaryRole}
                        </Chip>
                      )}
                      {extraCount > 0 && (
                        <Chip color="info" variant="outline" size="sm">
                          +{extraCount}
                        </Chip>
                      )}
                    </div>
                    <div className="px-4 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        aria-label="Edit permissions"
                        disabled={row.targetType.toLowerCase() !== "dataset"}
                        onClick={() => {
                          if (row.targetType.toLowerCase() !== "dataset")
                            return;
                          router.push(
                            getNavigationUrl(`/datasets/${row.targetId}`),
                          );
                        }}
                        className={`w-8 h-8 flex items-center justify-center rounded border ${
                          row.targetType.toLowerCase() === "dataset"
                            ? "border-slate-300 text-gray-650 hover:bg-slate-50"
                            : "border-slate-200 text-gray-400"
                        }`}
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.25} />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove permissions"
                        disabled
                        className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-gray-400"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.25} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      <DatasetPermissionsModal
        isOpen={Boolean(selectedDataset)}
        datasetId={selectedDataset?.id ?? ""}
        datasetName={selectedDataset?.name ?? "Dataset permissions"}
        onClose={() => setSelectedDataset(null)}
      />
    </div>
  );
}
