"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash } from "lucide-react";

type UserData = {
  name: string;
  surname: string;
};

interface Props {
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
}

export default function PersonalSettingsSection({
  userData,
  updateUserData,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 items-start justify-start border-b border-slate-200 pb-4">
        <h2 className="text-H2-20-semibold text-gray-750">Personal Settings</h2>
        <p className="text-body-14-regular text-gray-650">
          Manage your account information and security settings
        </p>
      </div>
      <div className="space-y-8">
        <div>
          <h3 className="text-body-16-medium text-gray-750 mb-4">
            Basic information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="name"
              label="Name"
              size="large"
              value={userData.name}
              onChange={(e) => updateUserData({ name: e.target.value })}
            />
            <Input
              name="surname"
              label="Surname"
              size="large"
              value={userData.surname}
              onChange={(e) => updateUserData({ surname: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200">
          <h3 className="text-body-16-medium text-gray-750 mb-2">
            Delete Account
          </h3>
          <p className="text-body-14-regular text-gray-650 mb-4">
            Permanently delete your account and all associated data
          </p>
          <Button
            variant="primary"
            className="bg-red-600 border-red-600 hover:bg-red-400 hover:border-red-400"
          >
            <Trash strokeWidth={1.25} className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}
