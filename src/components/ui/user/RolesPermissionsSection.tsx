"use client";

import { Chip } from "@ui/Chip";
import { Input } from "@ui/Input";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { logError } from "@/lib/logger";
import type { ContextGrant } from "@/types/contextGrants";
import type { UserGroupQueryResult } from "@/types/userDirectory";

type DropdownOption = {
  label: string;
  value: string;
};

type GrantRow = {
  id: string;
  targetName: string;
  targetType: string;
  role: string;
  principal: string;
  principalType: string;
};

const TARGET_KIND_LABELS: Record<number, string> = {
  0: "Dataset",
  1: "Collection",
};

const PRINCIPAL_KIND_LABELS: Record<number, string> = {
  0: "User",
  1: "Group",
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [principalFilter, setPrincipalFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
          logError("Failed to load user groups for grants", error);
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
                logError("Failed to load dataset names for grants", error);
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
                logError("Failed to load collection names for grants", error);
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

  const roleOptions = useMemo<DropdownOption[]>(() => {
    const roles = Array.from(
      new Set(
        grants.map((grant) => (grant.role?.trim() ? grant.role.trim() : "")),
      ),
    ).filter(Boolean);
    return [
      { label: "All roles", value: "all" },
      ...roles.map((role) => ({ label: role, value: role })),
    ];
  }, [grants]);

  const rows = useMemo<GrantRow[]>(() => {
    return grants.map((grant) => {
      const role = grant.role?.trim() || "Unknown";
      const targetTypeLabel =
        grant.targetType !== null && grant.targetType !== undefined
          ? (TARGET_KIND_LABELS[grant.targetType] ?? "Unknown")
          : "Unknown";
      const principalTypeLabel =
        grant.principalType !== null && grant.principalType !== undefined
          ? (PRINCIPAL_KIND_LABELS[grant.principalType] ?? "Unknown")
          : "Unknown";
      const targetId = grant.targetId ?? "";
      const targetName =
        grant.targetType === 0
          ? datasetNames[targetId] || targetId || "Unknown"
          : grant.targetType === 1
            ? collectionNames[targetId] || targetId || "Unknown"
            : targetId || "Unknown";
      const principal =
        grant.principalType === 1
          ? groupNames[grant.principalId ?? ""] ||
            grant.principalId ||
            "Unknown"
          : "Me";

      return {
        id: `${grant.targetId ?? "unknown"}-${grant.role ?? "unknown"}-${
          grant.principalId ?? "me"
        }`,
        targetName,
        targetType: targetTypeLabel,
        role,
        principal,
        principalType: principalTypeLabel,
      };
    });
  }, [collectionNames, datasetNames, grants, groupNames]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType =
        typeFilter === "all" || row.targetType.toLowerCase() === typeFilter;
      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      const matchesPrincipal =
        principalFilter === "all" ||
        row.principalType.toLowerCase() === principalFilter;
      const matchesSearch =
        !query || row.targetName.toLowerCase().includes(query);
      return matchesType && matchesRole && matchesPrincipal && matchesSearch;
    });
  }, [principalFilter, roleFilter, rows, searchQuery, typeFilter]);

  const typeOptions: DropdownOption[] = [
    { label: "All types", value: "all" },
    { label: "Dataset", value: "dataset" },
    { label: "Collection", value: "collection" },
  ];

  const principalOptions: DropdownOption[] = [
    { label: "All principals", value: "all" },
    { label: "User", value: "user" },
    { label: "Group", value: "group" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center h-12 border-b border-slate-200">
          <h2 className="text-[16px] font-semibold leading-[150%] text-gray-750">
            User Access
          </h2>
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
              label="Role"
              value={roleFilter}
              options={roleOptions}
              onChange={setRoleFilter}
            />
            <DropdownField
              label="Principal"
              value={principalFilter}
              options={principalOptions}
              onChange={setPrincipalFilter}
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
            <div className="grid grid-cols-[1fr_140px_160px_200px] bg-slate-50 text-[14px] text-gray-650 border-b border-slate-200">
              <div className="px-4 py-2 font-medium">Target</div>
              <div className="px-4 py-2 font-medium">Type</div>
              <div className="px-4 py-2 font-medium">Role</div>
              <div className="px-4 py-2 font-medium">Principal</div>
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
              filteredRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_140px_160px_200px] items-center h-14 border-b border-slate-200 last:border-b-0"
                >
                  <div className="px-4 text-[14px] text-gray-750 truncate">
                    {row.targetName}
                  </div>
                  <div className="px-4 text-[14px] text-gray-750">
                    {row.targetType}
                  </div>
                  <div className="px-4">
                    <Chip color="info" variant="outline" size="sm">
                      {row.role}
                    </Chip>
                  </div>
                  <div className="px-4 text-[14px] text-gray-750 truncate">
                    {row.principal}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
