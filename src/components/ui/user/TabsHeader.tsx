'use client';

import React from 'react';
import { Settings, Bell } from 'lucide-react';

type ActiveTab = 'personal' | 'preferences';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export default function TabsHeader({ activeTab, setActiveTab }: Props) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-6 py-4 text-body-16-medium border-b-2 transition-colors ${
            activeTab === 'personal'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 text-icon" />
          Personal settings
          <span className="text-descriptions-12-regular text-gray-400">Account information and security</span>
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-6 py-4 text-body-16-medium border-b-2 transition-colors ${
            activeTab === 'preferences'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-4 h-4 text-icon" />
          Preferences
          <span className="text-descriptions-12-regular text-gray-400">Notifications and app settings</span>
        </button>
      </nav>
    </div>
  );
}


