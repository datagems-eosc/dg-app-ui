"use client";

import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { Search, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import { ManageGroupsModal } from "./ManageGroupsModal";

type PermissionKey =
  | "browse"
  | "delete"
  | "download"
  | "edit"
  | "manage"
  | "search";

type GroupPermissionsRow = {
  id: string;
  name: string;
  permissions: Record<PermissionKey, boolean>;
};

type InvitedUser = {
  id: string;
  name: string;
  email: string;
  permissions: Record<PermissionKey, boolean>;
};

const permissionColumns: Array<{ key: PermissionKey; label: string }> = [
  { key: "browse", label: "Browse" },
  { key: "delete", label: "Delete" },
  { key: "download", label: "Download" },
  { key: "edit", label: "Edit" },
  { key: "manage", label: "Manage" },
  { key: "search", label: "Search" },
];

const initialGroupPermissions: GroupPermissionsRow[] = [
  {
    id: "analytics",
    name: "Analytics Team",
    permissions: {
      browse: false,
      delete: true,
      download: false,
      edit: false,
      manage: true,
      search: false,
    },
  },
  {
    id: "engineering",
    name: "Engineering Team",
    permissions: {
      browse: false,
      delete: true,
      download: false,
      edit: false,
      manage: true,
      search: false,
    },
  },
  {
    id: "moderators",
    name: "Moderators",
    permissions: {
      browse: false,
      delete: true,
      download: false,
      edit: false,
      manage: true,
      search: false,
    },
  },
  {
    id: "finance",
    name: "Finance Team",
    permissions: {
      browse: false,
      delete: false,
      download: true,
      edit: true,
      manage: true,
      search: false,
    },
  },
  {
    id: "researchers",
    name: "Researchers",
    permissions: {
      browse: false,
      delete: true,
      download: false,
      edit: false,
      manage: true,
      search: false,
    },
  },
  {
    id: "finance-duplicate",
    name: "Finance Team",
    permissions: {
      browse: false,
      delete: false,
      download: true,
      edit: true,
      manage: true,
      search: false,
    },
  },
];

const initialInvitedUsers: InvitedUser[] = [
  {
    id: "naomi",
    name: "Naomi Watts",
    email: "naomi.watts@gmail.com",
    permissions: {
      browse: false,
      delete: true,
      download: false,
      edit: false,
      manage: true,
      search: false,
    },
  },
];

interface DatasetPermissionsModalProps {
  isOpen: boolean;
  datasetName: string;
  onClose: () => void;
}

function PermissionSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`flex items-center w-7 h-4 rounded-full p-[2px] transition-colors ${
        checked ? "bg-[#052F4A] justify-end" : "bg-slate-200 justify-start"
      }`}
    >
      <span className="bg-white w-3 h-3 rounded-full shadow-[0px_0.6px_0.6px_0px_rgba(213,218,227,0.3)]" />
    </button>
  );
}

export function DatasetPermissionsModal({
  isOpen,
  datasetName,
  onClose,
}: DatasetPermissionsModalProps) {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<"groups" | "invite">("groups");
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteLookupLoading, setIsInviteLookupLoading] = useState(false);
  const [groupPermissions, setGroupPermissions] = useState(
    initialGroupPermissions,
  );
  const [invitedUsers, setInvitedUsers] = useState(initialInvitedUsers);
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

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("groups");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !api.hasToken) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.queryUserGroups({ like: null });
        if (cancelled) return;
        const groups =
          result.items?.map((group) => ({
            id: group.id ?? "",
            name: group.name ?? "",
            permissions: {
              browse: false,
              delete: false,
              download: false,
              edit: false,
              manage: false,
              search: false,
            },
          })) ?? [];
        setGroupPermissions(groups.filter((group) => group.id && group.name));
      } catch (error) {
        logError("Failed to load groups for permissions", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, isOpen]);

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

  const filteredGroupRows = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return groupPermissions;
    return groupPermissions.filter((row) =>
      row.name.toLowerCase().includes(query),
    );
  }, [groupPermissions, groupSearch]);

  const filteredInvitedUsers = useMemo(() => {
    const query = inviteSearch.trim().toLowerCase();
    if (!query) return invitedUsers;
    return invitedUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [inviteSearch, invitedUsers]);

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
                    {filteredGroupRows.map((row) => (
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
                                  setGroupPermissions((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? {
                                            ...item,
                                            permissions: {
                                              ...item.permissions,
                                              [column.key]:
                                                !item.permissions[column.key],
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className="h-10"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={async () => {
                          if (!inviteEmail.trim()) return;
                          const email = inviteEmail.trim();
                          setIsInviteLookupLoading(true);
                          try {
                            const result = await api.queryUsers({
                              like: email,
                            });
                            const match = result.items?.find(
                              (user) =>
                                user.email?.toLowerCase() ===
                                email.toLowerCase(),
                            );
                            setInvitedUsers((prev) => [
                              ...prev,
                              {
                                id: match?.id ?? `invite-${Date.now()}`,
                                name:
                                  match?.name ??
                                  email.split("@")[0] ??
                                  "Invited User",
                                email: match?.email ?? email,
                                permissions: { ...invitePermissions },
                              },
                            ]);
                            setInviteEmail("");
                          } catch (error) {
                            logError("Failed to lookup invite user", error);
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
                              key={`${user.id}-${column.key}`}
                              className="w-20 flex justify-center"
                            >
                              <PermissionSwitch
                                checked={user.permissions[column.key]}
                                ariaLabel={`${user.name} ${column.label}`}
                                onChange={() =>
                                  setInvitedUsers((prev) =>
                                    prev.map((item) =>
                                      item.id === user.id
                                        ? {
                                            ...item,
                                            permissions: {
                                              ...item.permissions,
                                              [column.key]:
                                                !item.permissions[column.key],
                                            },
                                          }
                                        : item,
                                    ),
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
                          onClick={() =>
                            setInvitedUsers((prev) =>
                              prev.filter((item) => item.id !== user.id),
                            )
                          }
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
        </div>
      </div>

      <ManageGroupsModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        onSave={() => setIsManageOpen(false)}
      />
    </>
  );
}
