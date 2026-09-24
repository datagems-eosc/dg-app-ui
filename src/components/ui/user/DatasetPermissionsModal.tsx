"use client";

import { Button } from "@ui/Button";
import { ConfirmationModal } from "@ui/ConfirmationModal";
import { Input } from "@ui/Input";
import { Search, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DatasetGroupAccess } from "@/components/DatasetPermissions/DatasetGroupAccess";
import {
  DATASET_ROLE_MAP,
  mapRolesToPermissions,
  type PermissionKey,
} from "@/config/contextGrantRoles";
import { useError } from "@/contexts/ErrorContext";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { useApi } from "@/hooks/useApi";
import { logError, logWarn } from "@/lib/logger";
import { ManageGroupsModal } from "./ManageGroupsModal";

type GroupPermissionsRow = {
  id: string;
  name: string;
  permissions: Record<PermissionKey, boolean>;
};

// Group discovery and every recipient-grant lookup of the current load must
// succeed before rows are shown, so a failed read is never presented as an
// empty result or as guessed switches.
type GroupPermissionsState =
  | { status: "loading" }
  | { status: "loaded"; rows: GroupPermissionsRow[] }
  | { status: "failed" };

const LOADING_GROUP_PERMISSIONS: GroupPermissionsState = { status: "loading" };
const FAILED_GROUP_PERMISSIONS: GroupPermissionsState = { status: "failed" };
const NO_GROUP_ROWS: GroupPermissionsRow[] = [];

const GROUP_READ_FAILURE_MESSAGE =
  "We couldn't load group permissions. Close and reopen this window to try again.";

type InvitedUser = {
  id?: string;
  name: string;
  email: string;
  permissions: Record<PermissionKey, boolean>;
  hasApiId: boolean;
};

const permissionColumns: Array<{ key: PermissionKey; label: string }> = [
  { key: "browse", label: "Browse" },
  { key: "delete", label: "Delete" },
  { key: "download", label: "Download" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "search", label: "Search" },
];

interface DatasetPermissionsModalProps {
  isOpen: boolean;
  datasetId: string;
  datasetName: string;
  onClose: () => void;
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

export function DatasetPermissionsModal({
  isOpen,
  datasetId,
  datasetName,
  onClose,
}: DatasetPermissionsModalProps) {
  const api = useApi();
  const { showError } = useError();
  const {
    hasToken,
    queryUserGroups,
    getGroupDatasetGrants,
    assignGroupDatasetGrant,
    unassignGroupDatasetGrant,
    queryUsers,
    getUserDatasetGrants,
    assignUserDatasetGrant,
    unassignUserDatasetGrant,
  } = api;
  const [activeTab, setActiveTab] = useState<"groups" | "invite">("groups");
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteLookupLoading, setIsInviteLookupLoading] = useState(false);
  const [groupState, setGroupState] = useState<GroupPermissionsState>(
    LOADING_GROUP_PERMISSIONS,
  );
  const [visibleGroupIds, setVisibleGroupIds] = useState<string[] | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [invitePermissions, setInvitePermissions] = useState<
    Record<PermissionKey, boolean>
  >({
    browse: false,
    delete: false,
    download: false,
    edit: false,
    manage: false,
    search: false,
  });
  const [revokeGroupId, setRevokeGroupId] = useState<string | null>(null);

  /**
   * Which group-access surface this opening belongs to.
   *
   * Latched when the modal opens rather than read live, so that turning the
   * rollout flag off with the new surface open cannot silently swap in the
   * legacy editor underneath the user. Losing the flag closes the modal
   * instead; the unresolved-operation journal is in storage and is untouched
   * by either. Reopening re-evaluates, so the flag still decides every fresh
   * session.
   */
  const groupAccessFlag = useFeatureFlag("datasetGroupAccess");
  const [session, setSession] = useState({ open: false, newFlow: false });
  if (session.open !== isOpen) {
    setSession({ open: isOpen, newFlow: isOpen ? groupAccessFlag : false });
  }
  const useNewGroupAccess = isOpen && session.open && session.newFlow;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("groups");
  }, [isOpen]);

  useEffect(() => {
    // Every load starts from scratch: rows and their selection belong to the
    // dataset currently being read, never to a previous dataset or load.
    setGroupState(LOADING_GROUP_PERMISSIONS);
    setVisibleGroupIds(null);
    // With the new flow selected, the legacy reads are not merely hidden —
    // they are not issued. Two readers for one dataset would double every
    // request and give the screen a second, older answer to disagree with.
    if (useNewGroupAccess) return;
    if (!isOpen || !hasToken || !datasetId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await queryUserGroups({
          project: { fields: ["id", "name"] },
          metadata: { countAll: true },
        });
        if (cancelled) return;
        const groups =
          result.items?.map((group) => ({
            id: group.id ?? "",
            name: group.name ?? "",
            permissions: mapRolesToPermissions([], DATASET_ROLE_MAP),
          })) ?? [];
        const validGroups = groups.filter((group) => group.id && group.name);

        const rows = await Promise.all(
          validGroups.map(async (group) => {
            const response = await getGroupDatasetGrants(group.id, [datasetId]);
            const roles = response?.[datasetId] ?? [];
            return {
              ...group,
              permissions: mapRolesToPermissions(roles, DATASET_ROLE_MAP),
            };
          }),
        );

        if (cancelled) return;
        setGroupState({ status: "loaded", rows });
        setVisibleGroupIds(rows.map((group) => group.id));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logWarn("Failed to load groups for permissions", {
          error: errorMessage,
        });
        if (cancelled) return;
        setGroupState(FAILED_GROUP_PERMISSIONS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    datasetId,
    getGroupDatasetGrants,
    hasToken,
    isOpen,
    queryUserGroups,
    useNewGroupAccess,
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

  const groupRows =
    groupState.status === "loaded" ? groupState.rows : NO_GROUP_ROWS;

  const updateLoadedGroupRows = (
    update: (rows: GroupPermissionsRow[]) => GroupPermissionsRow[],
  ) => {
    setGroupState((prev) =>
      prev.status === "loaded"
        ? { status: "loaded", rows: update(prev.rows) }
        : prev,
    );
  };

  const filteredGroupRows = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    const base = groupRows.filter((row) =>
      visibleGroupIds === null ? true : visibleGroupIds.includes(row.id),
    );
    if (!query) return base;
    return base.filter((row) => row.name.toLowerCase().includes(query));
  }, [groupRows, groupSearch, visibleGroupIds]);

  const filteredInvitedUsers = useMemo(() => {
    const query = inviteSearch.trim().toLowerCase();
    if (!query) return invitedUsers;
    return invitedUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [inviteSearch, invitedUsers]);

  const handleGroupToggle = async (
    groupId: string,
    permission: PermissionKey,
    nextValue: boolean,
  ) => {
    const role = DATASET_ROLE_MAP[permission];
    if (!role) return;
    try {
      if (nextValue) {
        await assignGroupDatasetGrant(groupId, datasetId, role);
      } else {
        await unassignGroupDatasetGrant(groupId, datasetId, role);
      }
      updateLoadedGroupRows((rows) =>
        rows.map((row) =>
          row.id === groupId
            ? {
                ...row,
                permissions: {
                  ...row.permissions,
                  [permission]: nextValue,
                },
              }
            : row,
        ),
      );
    } catch (error) {
      logError("Failed to update group permission", error);
      showError(
        "The server rejected the permission change. You may not have manage rights for this dataset.",
      );
    }
  };

  // Individual-user writes belong to the legacy modal only. The flag-on
  // destination is group-only, so these refuse even if somehow reached.
  const handleUserToggle = async (
    userId: string | undefined,
    permission: PermissionKey,
    nextValue: boolean,
  ) => {
    if (useNewGroupAccess || !userId) return;
    const role = DATASET_ROLE_MAP[permission];
    if (!role) return;
    try {
      if (nextValue) {
        await assignUserDatasetGrant(userId, datasetId, role);
      } else {
        await unassignUserDatasetGrant(userId, datasetId, role);
      }
      setInvitedUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                permissions: {
                  ...user.permissions,
                  [permission]: nextValue,
                },
              }
            : user,
        ),
      );
    } catch (error) {
      logError("Failed to update user permission", error);
      showError(
        "The server rejected the permission change. You may not have manage rights for this dataset.",
      );
    }
  };

  const handleRevokeGroupAccess = async (groupId: string) => {
    const row = groupRows.find((r) => r.id === groupId);
    if (!row) return;
    const rolesToRemove = (
      Object.keys(row.permissions) as PermissionKey[]
    ).filter((key) => row.permissions[key]);
    try {
      await Promise.all(
        rolesToRemove.map((key) => {
          const role = DATASET_ROLE_MAP[key];
          return role
            ? unassignGroupDatasetGrant(groupId, datasetId, role)
            : Promise.resolve();
        }),
      );
      updateLoadedGroupRows((rows) => rows.filter((r) => r.id !== groupId));
      setVisibleGroupIds((prev) =>
        prev ? prev.filter((id) => id !== groupId) : null,
      );
    } catch (error) {
      logError("Failed to revoke group access", error);
      showError(
        "The server rejected revoking access. You may not have manage rights for this dataset.",
      );
    } finally {
      setRevokeGroupId(null);
    }
  };

  const handleRemoveUser = async (user: InvitedUser) => {
    if (useNewGroupAccess) return;
    if (user.id) {
      const permissionsToRemove = (
        Object.keys(user.permissions) as PermissionKey[]
      )
        .filter((key) => user.permissions[key])
        .map((key) => DATASET_ROLE_MAP[key]);
      try {
        await Promise.all(
          permissionsToRemove.map((role) =>
            unassignUserDatasetGrant(user.id as string, datasetId, role),
          ),
        );
      } catch (error) {
        logError("Failed to remove user permissions", error);
      }
    }
    setInvitedUsers((prev) => prev.filter((item) => item.email !== user.email));
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="bg-white rounded-lg shadow-[0px_4px_10px_0px_rgba(29,41,61,0.1)] w-full max-w-[960px] h-[744px] max-h-[90vh] flex flex-col"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={datasetName}
        >
          <div className="flex items-center h-[72px] px-6 pr-4 border-b border-slate-200">
            <h2 className="text-[18px] font-semibold leading-[140%] text-slate-850 flex-1 truncate">
              {datasetName}
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

          {/*
            The tabs are the legacy modal's. With the new flow the destination
            is group-only: no Invite tab, no individual-user lookup or write.
            Invitations stay exactly as they were in the flag-off modal.
          */}
          {!useNewGroupAccess && (
            <div className="border-b border-slate-200 px-6">
              <div className="flex gap-2 h-[55px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("groups")}
                  className="relative flex items-end h-full px-2"
                >
                  <span
                    className={`text-[16px] font-medium leading-[150%] ${
                      activeTab === "groups" ? "text-gray-750" : "text-gray-650"
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
                  onClick={() => setActiveTab("invite")}
                  className="relative flex items-end h-full px-2"
                >
                  <span
                    className={`text-[16px] font-medium leading-[150%] ${
                      activeTab === "invite" ? "text-gray-750" : "text-gray-650"
                    }`}
                  >
                    Invite by E-mail
                  </span>
                  {activeTab === "invite" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 rounded-t-[2px]" />
                  )}
                </button>
              </div>
            </div>
          )}

          {useNewGroupAccess && (
            <div className="flex min-h-0 flex-1 flex-col">
              <DatasetGroupAccess
                datasetId={datasetId}
                datasetName={datasetName}
                onDone={onClose}
                // The flag going away is not evidence that the legacy editor is
                // now the right surface. Close, and leave the journal alone.
                onUnavailable={onClose}
              />
            </div>
          )}

          {/*
            Not merely hidden: while the new surface is open, the legacy body
            is not in the tree at all, so nothing of it is reachable by
            keyboard, by a screen reader, or by a test looking for a control
            that no longer applies.
          */}
          {!useNewGroupAccess && (
            <div className="flex-1 overflow-y-auto px-6 pt-2">
              {activeTab === "groups" && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <Input
                      name="group-search"
                      placeholder="Search"
                      value={groupSearch}
                      onChange={(event) => setGroupSearch(event.target.value)}
                      rightIcon={<Search className="w-4 h-4 text-icon" />}
                      className="h-10"
                    />
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setIsManageOpen(true)}
                      disabled={groupState.status !== "loaded"}
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
                    <div className="flex items-center h-12">
                      <div className="flex-1 text-[16px] font-semibold leading-[150%] text-gray-750">
                        Group permissions
                      </div>
                      <div className="flex gap-1 text-[14px] text-gray-750">
                        {permissionColumns.map((column) => (
                          <div key={column.key} className="w-20 text-center">
                            {column.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[401px] overflow-y-auto border-t border-b border-slate-200">
                      {groupState.status === "loading" && (
                        <div className="h-[72px] flex items-center px-4 text-[14px] text-gray-650">
                          Loading groups...
                        </div>
                      )}
                      {groupState.status === "failed" && (
                        <div
                          role="alert"
                          className="min-h-[72px] flex items-center px-4 py-4 text-[14px] text-red-600"
                        >
                          {GROUP_READ_FAILURE_MESSAGE}
                        </div>
                      )}
                      {groupState.status === "loaded" &&
                        filteredGroupRows.length === 0 && (
                          <div className="h-[72px] flex items-center px-4 text-[14px] text-gray-650">
                            No groups found
                          </div>
                        )}
                      {groupState.status === "loaded" &&
                        filteredGroupRows.map((row) => {
                          const hasAnyPermission = permissionColumns.some(
                            (col) => row.permissions[col.key],
                          );
                          return (
                            <div
                              key={row.id}
                              className="flex items-center h-[72px] border-b border-slate-200 last:border-b-0"
                            >
                              <div className="flex-1 text-[14px] font-medium text-slate-850">
                                {row.name}
                              </div>
                              <div className="flex gap-1">
                                {permissionColumns.map((column) => (
                                  <div
                                    key={`${row.id}-${column.key}`}
                                    className="w-20 flex justify-center"
                                  >
                                    <PermissionSwitch
                                      checked={row.permissions[column.key]}
                                      ariaLabel={`${row.name} ${column.label}`}
                                      onChange={() =>
                                        handleGroupToggle(
                                          row.id,
                                          column.key,
                                          !row.permissions[column.key],
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                              {hasAnyPermission && (
                                <button
                                  type="button"
                                  className="ml-2 text-[14px] text-red-550 hover:underline"
                                  onClick={() => setRevokeGroupId(row.id)}
                                >
                                  Revoke Access
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "invite" && (
                <div className="flex flex-col gap-6">
                  <Input
                    name="invite-search"
                    placeholder="Search"
                    value={inviteSearch}
                    onChange={(event) => setInviteSearch(event.target.value)}
                    rightIcon={<Search className="w-4 h-4 text-icon" />}
                    className="h-10"
                  />

                  <div>
                    <div className="flex items-center h-12">
                      <div className="flex-1 text-[16px] font-semibold leading-[150%] text-gray-750">
                        Invite new user
                      </div>
                      <div className="flex gap-1 text-[14px] text-gray-750">
                        {permissionColumns.map((column) => (
                          <div key={column.key} className="w-20 text-center">
                            {column.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center h-[72px] border-t border-b border-slate-200">
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          name="invite-email"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={(event) =>
                            setInviteEmail(event.target.value)
                          }
                          className="h-10"
                        />
                        <Button
                          variant="outline"
                          size="md"
                          onClick={async () => {
                            if (useNewGroupAccess || !inviteEmail.trim()) {
                              return;
                            }
                            const email = inviteEmail.trim();
                            setIsInviteLookupLoading(true);
                            try {
                              const result = await queryUsers({
                                like: email,
                              });
                              const match = result.items?.find(
                                (user) =>
                                  user.email?.toLowerCase() ===
                                  email.toLowerCase(),
                              );
                              const userId = match?.id ?? undefined;
                              let permissions = { ...invitePermissions };
                              if (userId) {
                                const grants = await getUserDatasetGrants(
                                  userId,
                                  [datasetId],
                                );
                                permissions = mapRolesToPermissions(
                                  grants?.[datasetId] ?? [],
                                  DATASET_ROLE_MAP,
                                );
                              }
                              setInvitedUsers((prev) => [
                                ...prev,
                                {
                                  id: userId,
                                  name:
                                    match?.name ??
                                    email.split("@")[0] ??
                                    "Invited User",
                                  email: match?.email ?? email,
                                  permissions,
                                  hasApiId: Boolean(userId),
                                },
                              ]);
                              setInviteEmail("");
                            } catch (error) {
                              logError("Failed to lookup invite user", error);
                              showError("Failed to look up the invited user.");
                            } finally {
                              setIsInviteLookupLoading(false);
                            }
                          }}
                          className="rounded-full"
                          disabled={isInviteLookupLoading}
                        >
                          Invite
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        {permissionColumns.map((column) => (
                          <div
                            key={column.key}
                            className="w-20 flex justify-center"
                          >
                            <PermissionSwitch
                              checked={invitePermissions[column.key]}
                              ariaLabel={`Invite ${column.label}`}
                              onChange={() =>
                                setInvitePermissions((prev) => ({
                                  ...prev,
                                  [column.key]: !prev[column.key],
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center h-12">
                      <div className="flex-1 text-[16px] font-semibold leading-[150%] text-gray-750">
                        Users invited
                      </div>
                      <div className="flex gap-1 text-[14px] text-gray-750">
                        {permissionColumns.map((column) => (
                          <div key={column.key} className="w-20 text-center">
                            {column.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-b border-slate-200">
                      {filteredInvitedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center h-[72px] border-b border-slate-200 last:border-b-0"
                        >
                          <div className="flex-1 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                              <div className="w-full h-full flex items-center justify-center text-[12px] font-medium text-gray-750">
                                {user.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-medium text-slate-850">
                                {user.name}
                              </span>
                              <span className="text-[12px] text-gray-650 tracking-[0.12px]">
                                {user.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {permissionColumns.map((column) => (
                              <div
                                key={`${user.email}-${column.key}`}
                                className="w-20 flex justify-center"
                              >
                                <PermissionSwitch
                                  checked={user.permissions[column.key]}
                                  ariaLabel={`${user.name} ${column.label}`}
                                  disabled={!user.hasApiId}
                                  onChange={() =>
                                    handleUserToggle(
                                      user.id,
                                      column.key,
                                      !user.permissions[column.key],
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="w-8 h-8 flex items-center justify-center rounded"
                            aria-label={`Remove ${user.name}`}
                            onClick={() => handleRemoveUser(user)}
                          >
                            <Trash2
                              className="w-4 h-4 text-icon"
                              strokeWidth={1.25}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/*
            The new surface carries its own footer, with a Done that closes and
            says so. Showing Save/Cancel beside it would re-introduce exactly
            the transaction promise the new view exists to remove; the legacy
            modal, which is unchanged, still has it.
          */}
          {!useNewGroupAccess && (
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
                onClick={onClose}
                className="rounded-full w-[148px]"
              >
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      <ManageGroupsModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        onSave={(selected) => {
          setVisibleGroupIds(selected.map((g) => g.id));
          setIsManageOpen(false);
        }}
        selectedGroupIds={visibleGroupIds ?? []}
      />

      <ConfirmationModal
        isVisible={Boolean(revokeGroupId)}
        onClose={() => setRevokeGroupId(null)}
        onConfirm={() => {
          if (revokeGroupId) {
            handleRevokeGroupAccess(revokeGroupId);
          }
        }}
        title="Revoke access"
        message1="Are you sure?"
        message2=""
        confirmText="Revoke"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </>
  );
}
