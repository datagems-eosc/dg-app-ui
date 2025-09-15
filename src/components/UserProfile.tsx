"use client";

import React, { useState } from "react";
import { Toast } from "./ui/Toast";
import { useUser } from "@/contexts/UserContext";
import UserHeader from "@/components/ui/user/UserHeader";
import TabsHeader from "@/components/ui/user/TabsHeader";
import PersonalSettingsSection from "@/components/ui/user/PersonalSettingsSection";
import PreferencesSection from "@/components/ui/user/PreferencesSection";
import { APP_ROUTES } from "@/config/appUrls";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"personal" | "preferences">(
    "preferences"
  );
  const [showToast, setShowToast] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [notifications, setNotifications] = useState<NotificationSettings>({
    newFeatures: { email: false, inApp: false },
    datasetLibraryChanges: { email: true, inApp: false },
    newDatasets: { email: false, inApp: true },
    systemMaintenance: { email: false, inApp: true },
    systemErrors: { email: false, inApp: false },
  });

  console.log(userData);

  const [backupUserData, setBackupUserData] = useState(userData);
  const [backupNotifications, setBackupNotifications] =
    useState<NotificationSettings>(notifications);

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
    if (!isEditing) router.push(APP_ROUTES.DASHBOARD);
    updateUserData(backupUserData);
    setNotifications(backupNotifications);
    setIsEditing(false);
  };

  const handleImageSelect = async (file: File) => {
    try {
      await setProfilePicture(file);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      // You could show a toast error here
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      await setProfilePicture(null);
    } catch (error) {
      console.error("Error removing profile picture:", error);
      // You could show a toast error here
    }
  };

  const handleEnableAll = () => {
    setNotifications({
      newFeatures: { email: true, inApp: true },
      datasetLibraryChanges: { email: true, inApp: true },
      newDatasets: { email: true, inApp: true },
      systemMaintenance: { email: true, inApp: true },
      systemErrors: { email: true, inApp: true },
    });
  };

  const handleDisableAll = () => {
    setNotifications({
      newFeatures: { email: false, inApp: false },
      datasetLibraryChanges: { email: false, inApp: false },
      newDatasets: { email: false, inApp: false },
      systemMaintenance: { email: false, inApp: false },
      systemErrors: { email: false, inApp: false },
    });
  };

  const updateNotification = (
    category: keyof NotificationSettings,
    type: "email" | "inApp",
    value: boolean
  ) => {
    setNotifications((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: value,
      },
    }));
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-6">
        <UserHeader
          isEditing={isEditing}
          isLoading={isLoading}
          userData={userData}
          onImageSelect={handleImageSelect}
          onRemoveProfilePicture={handleRemoveProfilePicture}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSave={handleSaveChanges}
        />

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "personal" && (
              <PersonalSettingsSection
                userData={userData}
                isEditing={isEditing}
                updateUserData={updateUserData}
              />
            )}

            {activeTab === "preferences" && (
              <PreferencesSection
                isEditing={isEditing}
                notifications={notifications}
                onEnableAll={handleEnableAll}
                onDisableAll={handleDisableAll}
                updateNotification={updateNotification}
              />
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
