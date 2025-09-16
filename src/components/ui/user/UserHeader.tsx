"use client";

import React from "react";
import { Avatar, AvatarUpload } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { Chip } from "../Chip";

type UserData = {
  name: string;
  surname: string;
  email: string;
  profilePicture?: string | null;
};

interface Props {
  isLoading: boolean;
  userData: UserData;
  onImageSelect: (file: File) => Promise<void>;
  onRemoveProfilePicture: () => Promise<void>;
  onCancel: () => void;
  onSave: () => void;
  hasChanges: boolean;
}

export default function UserHeader({
  isLoading,
  userData,
  onImageSelect,
  onRemoveProfilePicture,
  onCancel,
  onSave,
  hasChanges,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar
              src={userData.profilePicture}
              name={`${userData.name} ${userData.surname}`.trim()}
              email={userData.email}
              size="lPlus"
              isLoading={isLoading}
            />

            {userData.profilePicture && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRemoveProfilePicture}
                disabled={isLoading}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                Remove
              </Button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-H2-24-semibold text-gray-750">
                {userData.name} {userData.surname}
              </h1>
              <Chip color="success" size="sm">
                User
              </Chip>
            </div>
            <p className="text-H2-20-regular text-gray-650">{userData.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Tooltip
            content="Saving is temporarily disabled while backend integration is in progress."
            position="top"
          >
            <div>
              <Button variant="primary" disabled onClick={onSave}>
                Save Changes
              </Button>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
