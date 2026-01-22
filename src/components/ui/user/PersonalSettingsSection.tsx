"use client";

import { Button } from "@ui/Button";
import { Trash } from "lucide-react";

type FormData = {
  name: string;
  surname: string;
};

type UserData = {
  name: string;
  surname: string;
  email: string;
  profilePicture?: string | null;
};

interface Props {
  formData: FormData;
  userData: UserData;
}

export default function PersonalSettingsSection({ formData, userData }: Props) {
  const fullName = `${formData.name} ${formData.surname}`.trim();
  const initials =
    `${formData.name?.[0] || ""}${formData.surname?.[0] || ""}`.toUpperCase();

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="flex items-center h-12 mb-2">
        <h2 className="text-[16px] font-semibold leading-[150%] text-gray-750">
          Basic Info
        </h2>
      </div>

      <div className="flex flex-col gap-4 py-6 border-y border-slate-200 lg:flex-row lg:items-center lg:gap-8">
        <div className="w-full lg:w-[300px]">
          <div className="text-[14px] font-medium leading-[150%] text-gray-750">
            User Info
          </div>
          <div className="text-[12px] leading-[150%] text-gray-650 tracking-[0.12px]">
            Your account information
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200">
            {userData.profilePicture ? (
              <img
                src={userData.profilePicture}
                alt={fullName || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[12px] font-medium text-gray-650">
                {initials}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="text-[16px] font-semibold leading-[150%] text-gray-750">
                {fullName || "User"}
              </div>
              <div className="h-6 px-3 rounded-full bg-emerald-50 text-emerald-800 text-[12px] font-medium leading-[150%] tracking-[0.12px] flex items-center">
                User
              </div>
            </div>
            <div className="text-[12px] leading-[150%] text-gray-650 tracking-[0.12px]">
              {userData.email}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 py-6 border-y border-slate-200 -mt-px lg:flex-row lg:items-center lg:gap-8">
        <div className="w-full lg:w-[300px]">
          <div className="text-[14px] font-medium leading-[150%] text-gray-750">
            Account name
          </div>
          <div className="text-[12px] leading-[150%] text-gray-650 tracking-[0.12px]">
            Your account information
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium leading-[150%] text-gray-650">
              Name
            </div>
            <div className="mt-1 h-10 px-3 rounded-full border border-slate-200 bg-slate-50 flex items-center text-[14px] text-slate-450">
              {formData.name}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium leading-[150%] text-gray-650">
              Surname
            </div>
            <div className="mt-1 h-10 px-3 rounded-full border border-slate-200 bg-slate-50 flex items-center text-[14px] text-slate-450">
              {formData.surname}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 py-6 border-y border-slate-200 -mt-px lg:flex-row lg:items-center lg:gap-8">
        <div className="w-full lg:w-[300px]">
          <div className="text-[14px] font-medium leading-[150%] text-gray-750">
            Delete Account
          </div>
          <div className="text-[12px] leading-[150%] text-gray-650 tracking-[0.12px]">
            Permanently delete your account and all associated data
          </div>
        </div>
        <Button
          variant="primary"
          className="h-10 px-4 bg-red-600 border-red-600 hover:bg-red-600 hover:border-red-600 shadow-s1 w-full sm:w-auto"
        >
          <Trash strokeWidth={1.25} className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </div>
    </div>
  );
}
