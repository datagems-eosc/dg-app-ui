"use client";

import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import {
  ManageGroupsModal,
  type SelectedGroup,
} from "@ui/user/ManageGroupsModal";
import { Search, Settings2, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DATASET_ROLE_MAP,
  mapRolesToPermissions,
  type PermissionKey,
} from "@/config/contextGrantRoles";

const PERMISSION_COLUMNS: Array<{ key: PermissionKey; label: string }> = [
  { key: "browse", label: "Browse" },
  { key: "delete", label: "Delete" },
  { key: "download", label: "Download" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "search", label: "Search" },
];

export type AccessType = "public" | "restricted";

export type GroupPermissionRow = {
  id: string;
  name: string;
  permissions: Record<PermissionKey, boolean>;
};

interface AddDatasetShareStepProps {
  accessType: AccessType;
  onAccessTypeChange: (type: AccessType) => void;
  groupPermissions: GroupPermissionRow[];
  onGroupPermissionsChange: (rows: GroupPermissionRow[]) => void;
  onPublish: () => void;
  onCancel: () => void;
  isPublishing: boolean;
}

function PermissionSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`flex items-center w-7 h-4 rounded-full p-[2px] transition-colors ${
        checked ? "bg-[#052F4A] justify-end" : "bg-slate-200 justify-start"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className="bg-white w-3 h-3 rounded-full shadow-[0px_0.6px_0.6px_0px_rgba(213,218,227,0.3)]" />
    </button>
  );
}

export default function AddDatasetShareStep({
  accessType,
  onAccessTypeChange,
  groupPermissions,
  onGroupPermissionsChange,
  onPublish,
  onCancel,
  isPublishing,
}: AddDatasetShareStepProps) {
  const [activeTab, setActiveTab] = useState<"groups" | "invite">("groups");
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  const handleAddGroupSave = useCallback(
    (selected: SelectedGroup[]) => {
      const existingIds = new Set(groupPermissions.map((r) => r.id));
      const toAdd = selected.filter((g) => !existingIds.has(g.id));
      const newRows: GroupPermissionRow[] = toAdd.map((g) => ({
        id: g.id,
        name: g.name,
        permissions: mapRolesToPermissions([], DATASET_ROLE_MAP),
      }));
      if (newRows.length > 0) {
        onGroupPermissionsChange([...groupPermissions, ...newRows]);
      }
      setAddGroupModalOpen(false);
    },
    [groupPermissions, onGroupPermissionsChange],
  );

  const handleGroupToggle = useCallback(
    (groupId: string, permission: PermissionKey, nextValue: boolean) => {
      const role = DATASET_ROLE_MAP[permission];
      if (!role) return;
      onGroupPermissionsChange(
        groupPermissions.map((row) =>
          row.id === groupId
            ? {
                ...row,
                permissions: { ...row.permissions, [permission]: nextValue },
              }
            : row,
        ),
      );
    },
    [groupPermissions, onGroupPermissionsChange],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      onGroupPermissionsChange(
        groupPermissions.filter((row) => row.id !== groupId),
      );
    },
    [groupPermissions, onGroupPermissionsChange],
  );

  const filteredGroupRows = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return groupPermissions;
    return groupPermissions.filter((row) =>
      row.name.toLowerCase().includes(query),
    );
  }, [groupPermissions, groupSearch]);

  const isRestrictedConfigured =
    accessType === "restricted" && groupPermissions.length > 0;
  const canPublish =
    accessType === "public" ||
    (accessType === "restricted" && isRestrictedConfigured);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-semibold leading-[140%] text-slate-850 mb-1">
            Share the dataset
          </h2>
          <p className="text-[14px] text-gray-650 mb-6">
            You can share the dataset you uploaded with specific groups or users
            or make it public
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => onAccessTypeChange("public")}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                accessType === "public"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                    accessType === "public"
                      ? "border-blue-850 bg-blue-850"
                      : "border-slate-350"
                  }`}
                >
                  {accessType === "public" && (
                    <div className="w-2 h-2 rounded-full bg-white m-[5px]" />
                  )}
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-gray-750 mb-1">
                    Public access
                  </div>
                  <div className="text-[14px] text-gray-650">
                    The dataset will be visible to all users on the platform.
                    Anyone can view and access it.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAccessTypeChange("restricted")}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                accessType === "restricted"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                    accessType === "restricted"
                      ? "border-blue-850 bg-blue-850"
                      : "border-slate-350"
                  }`}
                >
                  {accessType === "restricted" && (
                    <div className="w-2 h-2 rounded-full bg-white m-[5px]" />
                  )}
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-gray-750 mb-1">
                    Restricted
                  </div>
                  <div className="text-[14px] text-gray-650">
                    Only you, platform admins, and people you choose can access
                    this dataset, all other users will not see it.
                  </div>
                </div>
              </div>
            </button>
          </div>

          {accessType === "restricted" && (
            <>
              <div className="border-b border-slate-200 mb-4">
                <div className="flex gap-2 h-[55px]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("groups")}
                    className="relative flex items-end h-full px-2"
                  >
                    <span
                      className={`text-[16px] font-medium leading-[150%] ${
                        activeTab === "groups"
                          ? "text-gray-750"
                          : "text-gray-650"
                      }`}
                    >
                      Groups
                    </span>
                    {activeTab === "groups" && (
                      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 rounded-t-[2px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="relative flex items-end h-full px-2 cursor-not-allowed"
                    aria-disabled="true"
                  >
                    <span className="text-[16px] font-medium leading-[150%] text-gray-650">
                      Invite by E-mail
                    </span>
                    <span className="ml-2 text-[12px] text-gray-500">
                      Coming soon
                    </span>
                  </button>
                </div>
              </div>

              {activeTab === "groups" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-[16px] font-semibold text-gray-750 mb-1">
                        Share with your Groups
                      </h3>
                      <p className="text-[14px] text-gray-650">
                        If you want to share the dataset with specific groups,
                        add them to the list
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setAddGroupModalOpen(true)}
                      className="shrink-0"
                    >
                      + Add groups
                    </Button>
                  </div>

                  {groupPermissions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          name="group-search"
                          placeholder="Search"
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                          icon={<Search className="w-4 h-4 text-icon" />}
                          className="h-10 flex-1"
                        />
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => setAddGroupModalOpen(true)}
                          className="rounded-full gap-2"
                        >
                          <Settings2
                            className="w-4 h-4 text-icon"
                            strokeWidth={1.25}
                          />
                          Manage
                        </Button>
                      </div>

                      <div>
                        <div className="flex items-center h-12 border-t border-b border-slate-200">
                          <div className="flex-1 text-[16px] font-semibold leading-[150%] text-gray-750">
                            Group
                          </div>
                          <div className="flex gap-1 text-[14px] text-gray-750">
                            {PERMISSION_COLUMNS.map((col) => (
                              <div key={col.key} className="w-20 text-center">
                                {col.label}
                              </div>
                            ))}
                          </div>
                          <div className="w-12" />
                        </div>
                        <div className="max-h-[320px] overflow-y-auto border-b border-slate-200">
                          {filteredGroupRows.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-center h-[72px] border-b border-slate-200 last:border-b-0"
                            >
                              <div className="flex-1 text-[14px] font-medium text-slate-850">
                                {row.name}
                              </div>
                              <div className="flex gap-1">
                                {PERMISSION_COLUMNS.map((col) => (
                                  <div
                                    key={`${row.id}-${col.key}`}
                                    className="w-20 flex justify-center"
                                  >
                                    <PermissionSwitch
                                      checked={row.permissions[col.key]}
                                      ariaLabel={`${row.name} ${col.label}`}
                                      onChange={() =>
                                        handleGroupToggle(
                                          row.id,
                                          col.key,
                                          !row.permissions[col.key],
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup(row.id)}
                                className="ml-2 p-2 text-red-550 hover:bg-red-50 rounded transition-colors"
                                aria-label={`Remove ${row.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onPublish}
            disabled={!canPublish || isPublishing}
            className="w-full sm:w-auto px-6 sm:px-8"
          >
            {isPublishing ? "Publishing..." : "Publish Dataset"}
          </Button>
        </div>
      </div>

      <ManageGroupsModal
        isOpen={addGroupModalOpen}
        onClose={() => setAddGroupModalOpen(false)}
        onSave={handleAddGroupSave}
        selectedGroupIds={groupPermissions.map((r) => r.id)}
        title="Add group"
      />
    </>
  );
}
