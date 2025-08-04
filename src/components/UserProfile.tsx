'use client';

import React, { useState } from 'react';
import { Settings, Bell, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Toast } from './ui/Toast';
import { Avatar, AvatarUpload } from './ui/Avatar';
import { useUser } from '@/contexts/UserContext';

interface NotificationSettings {
  newFeatures: {
    email: boolean;
    inApp: boolean;
  };
  datasetLibraryChanges: {
    email: boolean;
    inApp: boolean;
  };
  newDatasets: {
    email: boolean;
    inApp: boolean;
  };
  systemMaintenance: {
    email: boolean;
    inApp: boolean;
  };
  systemErrors: {
    email: boolean;
    inApp: boolean;
  };
}

export default function UserProfile() {
  const { userData, updateUserData, setProfilePicture, isLoading } = useUser();
  const [activeTab, setActiveTab] = useState<'personal' | 'preferences'>('preferences');
  const [showToast, setShowToast] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [notifications, setNotifications] = useState<NotificationSettings>({
    newFeatures: { email: false, inApp: false },
    datasetLibraryChanges: { email: true, inApp: false },
    newDatasets: { email: false, inApp: true },
    systemMaintenance: { email: false, inApp: true },
    systemErrors: { email: false, inApp: false }
  });

  const [backupUserData, setBackupUserData] = useState(userData);
  const [backupNotifications, setBackupNotifications] = useState<NotificationSettings>(notifications);

  const handleEdit = () => {
    setBackupUserData(userData);
    setBackupNotifications(notifications);
    setIsEditing(true);
  };

  const handleSaveChanges = () => {
    setShowToast(true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    updateUserData(backupUserData);
    setNotifications(backupNotifications);
    setIsEditing(false);
  };

  const handleImageSelect = async (file: File) => {
    try {
      await setProfilePicture(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      // You could show a toast error here
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      await setProfilePicture(null);
    } catch (error) {
      console.error('Error removing profile picture:', error);
      // You could show a toast error here
    }
  };

  const handleEnableAll = () => {
    setNotifications({
      newFeatures: { email: true, inApp: true },
      datasetLibraryChanges: { email: true, inApp: true },
      newDatasets: { email: true, inApp: true },
      systemMaintenance: { email: true, inApp: true },
      systemErrors: { email: true, inApp: true }
    });
  };

  const handleDisableAll = () => {
    setNotifications({
      newFeatures: { email: false, inApp: false },
      datasetLibraryChanges: { email: false, inApp: false },
      newDatasets: { email: false, inApp: false },
      systemMaintenance: { email: false, inApp: false },
      systemErrors: { email: false, inApp: false }
    });
  };

  const updateNotification = (category: keyof NotificationSettings, type: 'email' | 'inApp', value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: value
      }
    }));
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        {/* User Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                {isEditing ? (
                  <AvatarUpload
                    currentSrc={userData.profilePicture}
                    name={userData.name}
                    email={userData.email}
                    onImageSelect={handleImageSelect}
                    size="lg"
                    disabled={isLoading}
                  />
                ) : (
                  <Avatar
                    src={userData.profilePicture}
                    name={userData.name}
                    email={userData.email}
                    size="lg"
                  />
                )}
                
                {/* Remove button - show only in edit mode and when profile picture exists */}
                {isEditing && userData.profilePicture && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRemoveProfilePicture}
                    disabled={isLoading}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    Remove
                  </Button>
                )}
              </div>
              
              <div>
                <h1 className="text-H2-20-semibold text-gray-900">{userData.name} {userData.surname}</h1>
                <p className="text-body-16-regular text-gray-600">{userData.email}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-descriptions-12-semibold bg-green-100 text-green-800 mt-1">
                  User
                </span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!isEditing ? (
                <Button onClick={handleEdit}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2 text-icon" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveChanges}>
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Headers */}
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

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'personal' && (
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
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-H2-20-semibold text-gray-900">Notification Preferences</h2>
                      <p className="text-body-16-regular text-gray-600">Choose how you want to be notified about updates and changes</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleEnableAll} disabled={!isEditing}>
                        Enable All
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDisableAll} disabled={!isEditing}>
                        Disable All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* New Features */}
                    <div className="flex items-start justify-between py-4 border-b border-gray-100">
                      <div className="flex-1">
                        <h3 className="text-body-16-semibold text-gray-900">New Features</h3>
                        <p className="text-descriptions-12-regular text-gray-600">
                          Get notified when new features are added to the platform
                        </p>
                      </div>
                      <div className="flex items-center gap-8 ml-6">
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                          <Checkbox
                            id="new-features-email"
                            checked={notifications.newFeatures.email}
                            onChange={(checked) => updateNotification('newFeatures', 'email', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                          <Checkbox
                            id="new-features-app"
                            checked={notifications.newFeatures.inApp}
                            onChange={(checked) => updateNotification('newFeatures', 'inApp', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dataset Library Changes */}
                    <div className="flex items-start justify-between py-4 border-b border-gray-100">
                      <div className="flex-1">
                        <h3 className="text-body-16-semibold text-gray-900">Dataset Library Changes</h3>
                        <p className="text-descriptions-12-regular text-gray-600">
                          Receive updates about changes to the datasets library
                        </p>
                      </div>
                      <div className="flex items-center gap-8 ml-6">
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                          <Checkbox
                            id="library-changes-email"
                            checked={notifications.datasetLibraryChanges.email}
                            onChange={(checked) => updateNotification('datasetLibraryChanges', 'email', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                          <Checkbox
                            id="library-changes-app"
                            checked={notifications.datasetLibraryChanges.inApp}
                            onChange={(checked) => updateNotification('datasetLibraryChanges', 'inApp', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    {/* New Datasets */}
                    <div className="flex items-start justify-between py-4 border-b border-gray-100">
                      <div className="flex-1">
                        <h3 className="text-body-16-semibold text-gray-900">New Datasets</h3>
                        <p className="text-descriptions-12-regular text-gray-600">
                          Be informed when new datasets are added to the system
                        </p>
                      </div>
                      <div className="flex items-center gap-8 ml-6">
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                          <Checkbox
                            id="new-datasets-email"
                            checked={notifications.newDatasets.email}
                            onChange={(checked) => updateNotification('newDatasets', 'email', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                          <Checkbox
                            id="new-datasets-app"
                            checked={notifications.newDatasets.inApp}
                            onChange={(checked) => updateNotification('newDatasets', 'inApp', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    {/* System Maintenance */}
                    <div className="flex items-start justify-between py-4 border-b border-gray-100">
                      <div className="flex-1">
                        <h3 className="text-body-16-semibold text-gray-900">System Maintenance</h3>
                        <p className="text-descriptions-12-regular text-gray-600">
                          Get notified about planned system maintenance
                        </p>
                      </div>
                      <div className="flex items-center gap-8 ml-6">
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                          <Checkbox
                            id="maintenance-email"
                            checked={notifications.systemMaintenance.email}
                            onChange={(checked) => updateNotification('systemMaintenance', 'email', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                          <Checkbox
                            id="maintenance-app"
                            checked={notifications.systemMaintenance.inApp}
                            onChange={(checked) => updateNotification('systemMaintenance', 'inApp', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    {/* System Errors */}
                    <div className="flex items-start justify-between py-4">
                      <div className="flex-1">
                        <h3 className="text-body-16-semibold text-gray-900">System Errors</h3>
                        <p className="text-descriptions-12-regular text-gray-600">
                          Receive alerts about errors affecting your data or collections
                        </p>
                      </div>
                      <div className="flex items-center gap-8 ml-6">
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                          <Checkbox
                            id="errors-email"
                            checked={notifications.systemErrors.email}
                            onChange={(checked) => updateNotification('systemErrors', 'email', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                          <Checkbox
                            id="errors-app"
                            checked={notifications.systemErrors.inApp}
                            onChange={(checked) => updateNotification('systemErrors', 'inApp', checked)}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast 
        message="All your changes has been saved to the system"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
} 