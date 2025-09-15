"use client";

import React from "react";
import {
  Settings,
  Bell,
  LucideIcon,
  UserPenIcon,
  UserRoundPen,
} from "lucide-react";

type ActiveTab = "personal" | "preferences";

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

type TabItem = {
  key: ActiveTab;
  icon: LucideIcon;
  title: string;
  description: string;
};

const TABS: TabItem[] = [
  {
    key: "personal",
    icon: UserRoundPen,
    title: "Personal settings",
    description: "Account information and security",
  },
  {
    key: "preferences",
    icon: Bell,
    title: "Preferences",
    description: "Notifications and app settings",
  },
];

export default function TabsHeader({ activeTab, setActiveTab }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 pr-4 py-4">
      <nav className="flex flex-col gap-4">
        {TABS.map(({ key, icon: Icon, title, description }) => {
          const isActive = activeTab === key;
          return (
            <div key={key} className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                <div
                  className={`bg-blue-500 w-1 h-[48px] rounded-r-[4px] ${
                    isActive ? "bg-blue-600" : "bg-white"
                  }`}
                />
              </div>
              <button
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-start gap-4 px-3 py-2.25 rounded-lg transition-colors text-left cursor-pointer ${
                  isActive ? "bg-blue-75" : "hover:bg-slate-75"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon
                    className={`w-5 h-5 mt-0.5 ${
                      isActive ? "text-blue-850" : "text-icon"
                    }`}
                    strokeWidth={1.25}
                  />
                  <div className="flex flex-col">
                    <span className="text-H6-18-semibold text-gray-750">
                      {title}
                    </span>
                    <span className="text-body-14-regular text-slate-450">
                      {description}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
