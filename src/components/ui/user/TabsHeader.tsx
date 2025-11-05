"use client";

import { Bell, type LucideIcon, UserRoundPen } from "lucide-react";

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
    <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:pr-4 sm:py-4 sm:pl-0">
      <nav className="flex sm:flex-col gap-2 sm:gap-4 overflow-x-auto sm:overflow-visible">
        {TABS.map(({ key, icon: Icon, title, description }) => {
          const isActive = activeTab === key;
          return (
            <div
              key={key}
              className="flex items-stretch sm:items-center gap-2 sm:gap-4 min-w-[260px] sm:min-w-0"
            >
              <div className="flex items-center justify-center">
                <div
                  className={`bg-blue-500 w-1 h-[48px] rounded-r-[4px] hidden sm:block ${
                    isActive ? "bg-blue-600" : "bg-white"
                  }`}
                />
              </div>
              <button
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-start gap-3 sm:gap-4 px-3 py-2.25 rounded-lg transition-colors text-left cursor-pointer ${
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
                    <span className="text-[14px] sm:text-[18px] font-semibold leading-[150%] sm:leading-[140%] text-gray-750">
                      {title}
                    </span>
                    <span className="text-[12px] 3xl:text-[14px] font-normal leading-[150%] text-slate-450">
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
