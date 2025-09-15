'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

type UserData = {
  name: string;
  surname: string;
};

interface Props {
  userData: UserData;
  isEditing: boolean;
  updateUserData: (data: Partial<UserData>) => void;
}

export default function PersonalSettingsSection({ userData, isEditing, updateUserData }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-H2-20-semibold text-gray-900 mb-6">Personal Settings</h2>
        <p className="text-body-16-regular text-gray-600 mb-6">Manage your account information and security settings</p>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-body-16-semibold text-gray-900 mb-4">Basic information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-body-16-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={userData.name}
                  onChange={(e) => updateUserData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label htmlFor="surname" className="block text-body-16-medium text-gray-700 mb-2">
                  Surname
                </label>
                <input
                  type="text"
                  id="surname"
                  value={userData.surname}
                  onChange={(e) => updateUserData({ surname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200">
            <h3 className="text-body-16-semibold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-descriptions-12-regular text-gray-600 mb-4">
              Permanently delete your account and all associated data
            </p>
            <Button variant="outline" className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100" disabled={!isEditing}>
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


