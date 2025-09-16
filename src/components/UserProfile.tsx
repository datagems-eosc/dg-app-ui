"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    "personal"
  );
  const [showToast, setShowToast] = useState(false);
  const [formData, setFormData] = useState({ name: userData.name, surname: userData.surname });

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

  useEffect(() => {
    setBackupUserData(userData);
    setFormData({ name: userData.name, surname: userData.surname });
  }, [userData.name, userData.surname]);

  const handleSaveChanges = () => {
    updateUserData({ name: formData.name, surname: formData.surname });
    setBackupUserData({ ...userData, name: formData.name, surname: formData.surname });
    setBackupNotifications(notifications);
    setShowToast(true);
  };

  const handleCancel = () => {
    router.push(APP_ROUTES.DASHBOARD);
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

  const hasUserDataChanges = useMemo(() => {
    return (
      (backupUserData?.name || "") !== (formData?.name || "") ||
      (backupUserData?.surname || "") !== (formData?.surname || "")
    );
  }, [backupUserData, formData]);

  const hasNotificationChanges = useMemo(() => {
    return (
      JSON.stringify(backupNotifications) !== JSON.stringify(notifications)
    );
  }, [backupNotifications, notifications]);

  const hasChanges = hasUserDataChanges || hasNotificationChanges;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <UserHeader
          isLoading={isLoading}
          userData={userData}
          onImageSelect={handleImageSelect}
          onRemoveProfilePicture={handleRemoveProfilePicture}
          onCancel={handleCancel}
          onSave={handleSaveChanges}
          hasChanges={hasChanges}
        />

        {/* Body with left Tabs and right Content */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
          <div className="lg:col-span-3 order-1">
            <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div className="lg:col-span-7 order-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
              {activeTab === "personal" && (
                <PersonalSettingsSection
                  formData={formData}
                  updateFormData={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                />
              )}

              {activeTab === "preferences" && (
                <PreferencesSection
                  notifications={notifications}
                  onEnableAll={handleEnableAll}
                  onDisableAll={handleDisableAll}
                  updateNotification={updateNotification}
                />
              )}
            </div>
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
