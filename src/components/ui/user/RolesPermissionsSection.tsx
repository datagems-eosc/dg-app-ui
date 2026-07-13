"use client";

import { Checkbox } from "@ui/Checkbox";
import { Chip } from "@ui/Chip";
import { ConfirmationModal } from "@ui/ConfirmationModal";
import { Input } from "@ui/Input";
import { Tooltip } from "@ui/Tooltip";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatasetPermissionsModal } from "@/components/ui/user/DatasetPermissionsModal";
import { APP_ROUTES } from "@/config/appUrls";
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
  /** False when the grant references a target the API no longer returns (deleted or inaccessible). */
  resolved: boolean;
  roles: string[];
  groupCount: number;
  groupIds: string[];
  uploadedBy?: string | null;
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

type SortKey = "assetName" | "groupsAdded" | "permission";
type SortDirection = "asc" | "desc";
type SortRule = { key: SortKey; direction: SortDirection };

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

const DATASET_ID_QUERY = "datasetId";

export default function RolesPermissionsSection() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetIdFilter = searchParams.get(DATASET_ID_QUERY);
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
  // True when the name lookup itself failed — rows must then stay interactive
  // with the ID as the name instead of being misreported as deleted targets.
  const [datasetLookupFailed, setDatasetLookupFailed] = useState(false);
  const [collectionLookupFailed, setCollectionLookupFailed] = useState(false);
  const [datasetUploadedBy, setDatasetUploadedBy] = useState<
    Record<string, string | null>
  >({});
  const [collectionUploadedBy, setCollectionUploadedBy] = useState<
    Record<string, string | null>
  >({});
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState("datasets");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [principalScope, setPrincipalScope] = useState("me");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirmDataset, setDeleteConfirmDataset] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (datasetIdFilter) {
      setTypeFilter("datasets");
    }
  }, [datasetIdFilter]);

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
          groupsResult = await queryUserGroups({
            project: { fields: ["id", "name"] },
            metadata: { countAll: true },
          });
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

        const datasetIds = Array.from(
          new Set(
            grantsResult
              .filter((grant) => grant.targetType === 0 && grant.targetId)
              .map((grant) => grant.targetId as string),
          ),
        );
        const collectionIds = Array.from(
          new Set(
            grantsResult
              .filter((grant) => grant.targetType === 1 && grant.targetId)
              .map((grant) => grant.targetId as string),
          ),
        );

        let datasetsFailed = false;
        let collectionsFailed = false;
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
                datasetsFailed = true;
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
                collectionsFailed = true;
                return { items: [] };
              })
            : Promise.resolve({ items: [] }),
        ]);

        if (cancelled) return;

        const datasetItems = (datasetsResult.items ?? []) as Array<{
          id?: string;
          name?: string;
          createdBy?: string | null;
        }>;
        // Every returned item counts as resolved; a blank name falls back to
        // the ID for display but must not be misreported as a deleted target.
        const datasetMap = datasetItems
          .filter((item) => item.id)
          .reduce((acc: Record<string, string>, item) => {
            acc[item.id as string] = item.name?.trim() || (item.id as string);
            return acc;
          }, {});
        const datasetUploadedByMap = datasetItems
          .filter((item) => item.id)
          .reduce<Record<string, string | null>>((acc, item) => {
            if (item.id) acc[item.id] = item.createdBy ?? null;
            return acc;
          }, {});
        const collectionItems = (collectionsResult.items ?? []) as Array<{
          id?: string;
          name?: string;
          createdBy?: string | null;
        }>;
        const collectionMap = collectionItems
          .filter((item) => item.id)
          .reduce((acc: Record<string, string>, item) => {
            acc[item.id as string] = item.name?.trim() || (item.id as string);
            return acc;
          }, {});
        const collectionUploadedByMap = collectionItems
          .filter((item) => item.id)
          .reduce<Record<string, string | null>>((acc, item) => {
            if (item.id) acc[item.id] = item.createdBy ?? null;
            return acc;
          }, {});

        if (!datasetsFailed && datasetItems.length < datasetIds.length) {
          logWarn("Dataset name lookup returned fewer items than requested", {
            requested: datasetIds.length,
            returned: datasetItems.length,
          });
        }
        if (
          !collectionsFailed &&
          collectionItems.length < collectionIds.length
        ) {
          logWarn(
            "Collection name lookup returned fewer items than requested",
            {
              requested: collectionIds.length,
              returned: collectionItems.length,
            },
          );
        }

        setDatasetNames(datasetMap);
        setCollectionNames(collectionMap);
        setDatasetUploadedBy(datasetUploadedByMap);
        setCollectionUploadedBy(collectionUploadedByMap);
        setDatasetLookupFailed(datasetsFailed);
        setCollectionLookupFailed(collectionsFailed);
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
      const lookupFailed =
        entry.targetType === 0
          ? datasetLookupFailed
          : entry.targetType === 1
            ? collectionLookupFailed
            : false;
      const resolvedName =
        entry.targetType === 0
          ? datasetNames[entry.targetId]
          : entry.targetType === 1
            ? collectionNames[entry.targetId]
            : undefined;
      const kindLabel = TARGET_KIND_LABELS[entry.targetType] ?? "Unknown";
      // A failed lookup says nothing about whether the target exists — keep
      // the row fully usable and show the ID in place of the name.
      const resolved = lookupFailed || Boolean(resolvedName);
      const targetName =
        resolvedName ||
        (lookupFailed
          ? entry.targetId
          : `Unknown ${TARGET_KIND_LABELS[entry.targetType]?.toLowerCase() ?? "target"}`);
      const uploadedBy =
        entry.targetType === 0
          ? (datasetUploadedBy[entry.targetId] ?? null)
          : entry.targetType === 1
            ? (collectionUploadedBy[entry.targetId] ?? null)
            : null;

      return {
        id: `${entry.targetType}-${entry.targetId}`,
        targetId: entry.targetId,
        targetName,
        targetType: kindLabel,
        resolved,
        roles: Array.from(entry.roles),
        groupCount: entry.groups.size,
        groupIds: Array.from(entry.groups),
        uploadedBy,
      };
    });
  }, [
    collectionLookupFailed,
    collectionNames,
    collectionUploadedBy,
    datasetLookupFailed,
    datasetNames,
    datasetUploadedBy,
    grants,
    principalScope,
  ]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (
        datasetIdFilter &&
        row.targetType.toLowerCase() === "dataset" &&
        row.targetId !== datasetIdFilter
      ) {
        return false;
      }
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
        !query ||
        row.targetName.toLowerCase().includes(query) ||
        row.targetId.toLowerCase().includes(query);
      return matchesType && matchesRole && matchesGroup && matchesSearch;
    });
  }, [
    datasetIdFilter,
    grants,
    groupFilter,
    roleFilter,
    rows,
    searchQuery,
    typeFilter,
  ]);

  const unresolvedCount = useMemo(
    () => filteredRows.filter((row) => !row.resolved).length,
    [filteredRows],
  );

  const activeKind = typeFilter === "collections" ? "collection" : "dataset";
  const activeLookupFailed =
    typeFilter === "collections" ? collectionLookupFailed : datasetLookupFailed;

  const getPermissionLabel = (row: GrantRow) => row.roles[0] ?? "";

  const getSortValue = (row: GrantRow, key: SortKey) => {
    // Tiebreak equal names (e.g. several "Unknown dataset" rows) by the
    // visible target ID so ordering matches what the user sees.
    if (key === "assetName")
      return `${row.targetName.toLowerCase()} ${row.targetId}`;
    if (key === "groupsAdded") return row.groupCount;
    if (key === "permission") return getPermissionLabel(row).toLowerCase();
    return "";
  };

  const sortedRows = useMemo(() => {
    if (sortRules.length === 0) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      for (const rule of sortRules) {
        const aVal = getSortValue(a, rule.key);
        const bVal = getSortValue(b, rule.key);
        if (aVal < bVal) return rule.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return rule.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredRows, sortRules]);

  const getSortDirection = (key: SortKey) =>
    sortRules.find((rule) => rule.key === key)?.direction ?? null;

  const toggleSort = (key: SortKey) => {
    setSortRules((prev) => {
      const existing = prev.find((rule) => rule.key === key);
      if (!existing) return [...prev, { key, direction: "asc" }];
      if (existing.direction === "asc") {
        return prev.map((rule) =>
          rule.key === key ? { ...rule, direction: "desc" } : rule,
        );
      }
      return prev.filter((rule) => rule.key !== key);
    });
  };

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
            {!isLoading && activeLookupFailed && (
              <span className="text-gray-650">
                {" "}
                · {activeKind} names could not be loaded — showing identifiers
              </span>
            )}
            {!isLoading && !activeLookupFailed && unresolvedCount > 0 && (
              <span className="text-gray-650">
                {" "}
                ·{" "}
                {unresolvedCount === 1
                  ? `1 references a ${activeKind} that no longer exists or is inaccessible`
                  : `${unresolvedCount} reference ${activeKind}s that no longer exist or are inaccessible`}
              </span>
            )}
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div>
              <div className="max-h-[420px] overflow-y-auto">
                <div className="grid grid-cols-[1fr_126px_180px_122px_137px] bg-slate-50 text-[14px] text-gray-650 border-b border-slate-200 sticky top-0 z-10 h-10">
                  <button
                    type="button"
                    onClick={() => toggleSort("assetName")}
                    className="px-4 font-medium text-left flex items-center gap-1"
                  >
                    {typeFilter === "collections"
                      ? "Collection name"
                      : "Dataset name"}
                    {getSortDirection("assetName") === "asc" && (
                      <ArrowUp className="w-4 h-4 text-icon" />
                    )}
                    {getSortDirection("assetName") === "desc" && (
                      <ArrowDown className="w-4 h-4 text-icon" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSort("groupsAdded")}
                    className="px-4 font-medium text-left flex items-center gap-1"
                  >
                    Groups Added
                    {getSortDirection("groupsAdded") === "asc" && (
                      <ArrowUp className="w-4 h-4 text-icon" />
                    )}
                    {getSortDirection("groupsAdded") === "desc" && (
                      <ArrowDown className="w-4 h-4 text-icon" />
                    )}
                  </button>
                  <div className="px-4 font-medium flex items-center">
                    Uploaded by
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSort("permission")}
                    className="px-4 font-medium text-left flex items-center gap-1"
                  >
                    Permissions
                    {getSortDirection("permission") === "asc" && (
                      <ArrowUp className="w-4 h-4 text-icon" />
                    )}
                    {getSortDirection("permission") === "desc" && (
                      <ArrowDown className="w-4 h-4 text-icon" />
                    )}
                  </button>
                  <div className="px-4 font-medium flex items-center">
                    Dataset Actions
                  </div>
                </div>
                {isLoading && (
                  <div className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`skeleton-${index}`}
                        className="grid grid-cols-[1fr_126px_180px_122px_137px] items-center h-14 border-b border-slate-200 last:border-b-0"
                      >
                        <div className="px-4">
                          <div className="h-3 bg-slate-100 rounded w-3/5" />
                        </div>
                        <div className="px-4">
                          <div className="h-3 bg-slate-100 rounded w-1/2" />
                        </div>
                        <div className="px-4">
                          <div className="h-3 bg-slate-100 rounded w-1/2" />
                        </div>
                        <div className="px-4">
                          <div className="h-3 bg-slate-100 rounded w-1/3" />
                        </div>
                        <div className="px-4 flex items-center justify-end">
                          <div className="h-3 bg-slate-100 rounded w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoading && errorMessage && (
                  <div className="px-4 py-6 text-[14px] text-gray-650">
                    {errorMessage}
                  </div>
                )}
                {!isLoading && !errorMessage && sortedRows.length === 0 && (
                  <div className="px-4 py-6 text-[14px] text-gray-650">
                    No results found. Please try different search.
                  </div>
                )}
                {!isLoading &&
                  !errorMessage &&
                  sortedRows.map((row) => {
                    const roles = row.roles;
                    const primaryRole = roles[0];
                    const extraCount = Math.max(roles.length - 1, 0);
                    const isInteractiveDataset =
                      row.resolved &&
                      row.targetType.toLowerCase() === "dataset";
                    const hasEditRights =
                      isInteractiveDataset &&
                      (roles.includes("Edit") || roles.includes("Manage"));
                    const hasDeleteRights =
                      isInteractiveDataset &&
                      (roles.includes("Delete") || roles.includes("Manage"));
                    const groupsTooltip =
                      row.groupCount > 0
                        ? row.groupIds
                            .map((id) => groupNames[id] ?? id)
                            .join(", ")
                        : "";
                    const permissionsTooltip =
                      roles.length > 0 ? roles.join(", ") : "";
                    return (
                      <div
                        key={row.id}
                        role="row"
                        className={`grid grid-cols-[1fr_126px_180px_122px_137px] items-center h-14 border-b border-slate-200 last:border-b-0 ${
                          isInteractiveDataset
                            ? "cursor-pointer hover:bg-slate-50"
                            : ""
                        }`}
                        onClick={() => {
                          if (!isInteractiveDataset) return;
                          setSelectedDataset({
                            id: row.targetId,
                            name: row.targetName,
                          });
                        }}
                      >
                        <div className="px-4 min-w-0">
                          {isInteractiveDataset ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(
                                  getNavigationUrl(
                                    `${APP_ROUTES.DATASET_DETAILS(row.targetId)}?returnTo=settings-roles`,
                                  ),
                                );
                              }}
                              className="block max-w-full truncate text-left text-[14px] text-gray-750 hover:underline"
                            >
                              {row.targetName}
                            </button>
                          ) : (
                            <div
                              className={`truncate text-[14px] ${
                                row.resolved
                                  ? "text-gray-750"
                                  : "italic text-gray-500"
                              }`}
                            >
                              {row.targetName}
                            </div>
                          )}
                          <Tooltip
                            content={row.targetId}
                            position="top"
                            delay={300}
                          >
                            <div className="truncate font-mono text-[12px] text-gray-500">
                              {row.targetId}
                            </div>
                          </Tooltip>
                        </div>
                        <div className="px-4 flex items-center justify-center">
                          {row.groupCount > 0 && groupsTooltip ? (
                            <Tooltip
                              content={groupsTooltip}
                              position="top"
                              delay={300}
                            >
                              <span className="inline-flex cursor-default">
                                <Chip
                                  color="grey"
                                  size="xs"
                                  className="h-6 px-3"
                                >
                                  {row.groupCount}
                                </Chip>
                              </span>
                            </Tooltip>
                          ) : (
                            <Chip color="grey" size="xs" className="h-6 px-3">
                              {row.groupCount}
                            </Chip>
                          )}
                        </div>
                        <div className="px-4 text-[14px] text-gray-750">
                          {row.uploadedBy ?? "—"}
                        </div>
                        <div className="px-4 flex items-center gap-1">
                          {primaryRole && (
                            <Chip color="grey" size="xs" className="h-6 px-3">
                              {primaryRole}
                            </Chip>
                          )}
                          {extraCount > 0 ? (
                            permissionsTooltip ? (
                              <Tooltip
                                content={permissionsTooltip}
                                position="top"
                                delay={300}
                              >
                                <span className="inline-flex cursor-default">
                                  <Chip
                                    color="grey"
                                    size="xs"
                                    className="h-6 px-3"
                                  >
                                    +{extraCount}
                                  </Chip>
                                </span>
                              </Tooltip>
                            ) : (
                              <Chip color="grey" size="xs" className="h-6 px-3">
                                +{extraCount}
                              </Chip>
                            )
                          ) : null}
                        </div>
                        <div
                          className="px-4 flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label="Edit dataset"
                            disabled={!hasEditRights}
                            onClick={() => {
                              if (!hasEditRights) return;
                              router.push(
                                getNavigationUrl(
                                  `${APP_ROUTES.DATASET_ADD}?datasetId=${row.targetId}`,
                                ),
                              );
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded ${
                              hasEditRights
                                ? "text-gray-650 hover:bg-slate-50"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            <Pencil className="w-4 h-4" strokeWidth={1.25} />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete dataset"
                            disabled={!hasDeleteRights}
                            onClick={() => {
                              if (!hasDeleteRights) return;
                              setDeleteConfirmDataset({
                                id: row.targetId,
                                name: row.targetName,
                              });
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded ${
                              hasDeleteRights
                                ? "text-gray-650 hover:bg-slate-50"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
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
        </div>
      </div>
      <DatasetPermissionsModal
        isOpen={Boolean(selectedDataset)}
        datasetId={selectedDataset?.id ?? ""}
        datasetName={selectedDataset?.name ?? "Dataset permissions"}
        onClose={() => setSelectedDataset(null)}
        hasManageRights={Boolean(
          selectedDataset &&
            grants.some(
              (g) =>
                g.targetId === selectedDataset.id &&
                g.targetType === 0 &&
                (g.role?.toLowerCase().includes("manage") ?? false),
            ),
        )}
      />
      <ConfirmationModal
        isVisible={Boolean(deleteConfirmDataset)}
        onClose={() => setDeleteConfirmDataset(null)}
        onConfirm={() => {
          if (!deleteConfirmDataset) return;
          setDeleteConfirmDataset(null);
        }}
        title="Delete dataset"
        message1="Are you sure to delete dataset?"
        message2=""
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </div>
  );
}
