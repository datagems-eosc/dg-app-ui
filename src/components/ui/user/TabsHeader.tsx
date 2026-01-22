"use client";

import { Bell, FolderLock, type LucideIcon, UserRoundPen } from "lucide-react";

type ActiveTab = "personal" | "notifications" | "roles";

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

type TabItem = {
  key: ActiveTab;
  icon: LucideIcon;
  title: string;
};

const TABS: TabItem[] = [
  {
    key: "personal",
    icon: UserRoundPen,
    title: "Personal settings",
  },
  {
    key: "notifications",
    icon: Bell,
    title: "Notifications",
  },
  {
    key: "roles",
    icon: FolderLock,
    title: "Roles & Permissions",
  },
];

export default function TabsHeader({ activeTab, setActiveTab }: Props) {
  return (
    <div className="w-full border-b border-slate-200">
      <nav className="flex gap-4 overflow-x-auto">
        {TABS.map(({ key, icon: Icon, title }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="relative flex items-center gap-2 h-[55px] px-2 pb-[14px] whitespace-nowrap"
            >
              <Icon
                className={`w-[25px] h-[25px] ${
                  isActive ? "text-blue-500" : "text-icon"
                }`}
                strokeWidth={1.25}
              />
              <span
                className={`text-[18px] font-medium leading-[140%] ${
                  isActive ? "text-gray-750" : "text-gray-650"
                }`}
              >
                {title}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 rounded-t-[2px]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
