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
import { apiClient } from "@/lib/apiClient";
import { useSession } from "next-auth/react";

interface UserData {
  id?: string;
  eTag?: string;
  name: string;
  surname: string;
}

interface NotificationSettings {
  id?: string;
  eTag?: string;
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
  const { data: session } = useSession();

  const { userData, updateUserData, setProfilePicture } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"personal" | "preferences">(
    "personal"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [personalSettings, setPersonalSettings] = useState<UserData>({
    name: "",
    surname: "",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    newFeatures: { email: false, inApp: false },
    datasetLibraryChanges: { email: true, inApp: false },
    newDatasets: { email: false, inApp: true },
    systemMaintenance: { email: false, inApp: true },
    systemErrors: { email: false, inApp: false },
  });

  const [backupUserData, setBackupUserData] = useState(userData);
  const [backupNotifications, setBackupNotifications] =
    useState<NotificationSettings>(notifications);

  useEffect(() => {
    setBackupUserData(userData);
  }, [userData.name, userData.surname]);

  useEffect(() => {
    const token = (session as any)?.accessToken;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        await Promise.all([
          loadNotificationSettings(token),
          loadPersonalSettings(token),
        ]);
      } catch (err) {
        console.error("Failed loading user settings:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Make loaders return promises
  async function loadPersonalSettings(token: string) {
    if (!token) return;
    try {
      const settings = await apiClient.getUserSettings(
        "personalSettings",
        token
      );
      if (!settings || settings.length === 0) return;
      const lastIndex = settings.length - 1;
      const data = JSON.parse(settings[lastIndex].value);
      setPersonalSettings({
        name: data.name,
        surname: data.surname,
        id: settings[lastIndex].id,
        eTag: settings[lastIndex].eTag,
      });
    } catch (err) {
      console.error("Failed to load userData", err);
    }
  }

  async function loadNotificationSettings(token: string) {
    if (!token) return;
    try {
      const settings = await apiClient.getUserSettings(
        "notificationSettings",
        token
      );
      if (!settings || settings.length === 0) return;
      const lastIndex = settings.length - 1;
      setNotifications({
        ...JSON.parse(settings[lastIndex].value),
        id: settings[lastIndex].id,
        eTag: settings[lastIndex].eTag,
      });
    } catch (err) {
      console.error("Failed to load notificationSettings", err);
    }
  }

  const handleSaveChanges = () => {
    setIsLoading(true);
    saveNotificationSettings();
    savePersonalSettings();

    updateUserData({
      name: personalSettings.name,
      surname: personalSettings.surname,
    });
    setBackupUserData({
      ...userData,
      name: personalSettings.name,
      surname: personalSettings.surname,
    });
    setBackupNotifications(notifications);
    setShowToast(true);
  };

  const saveNotificationSettings = () => {
    const token = (session as any)?.accessToken;
    if (!token) return;

    // send notification settings with `value` not containing the `id` field
    const { id, eTag, ...value } = notifications as any;
    const payload: any = {
      key: "notificationSettings",
      value,
    };

    if (id) payload.id = id;
    if (eTag) payload.eTag = eTag;

    apiClient.saveUserSettings(payload, token);
  };
  const savePersonalSettings = () => {
    const token = (session as any)?.accessToken;
    if (!token) return;

    // send notification settings with `value` not containing the `id` field
    const { id, eTag, ...value } = personalSettings as any;
    const payload: any = {
      key: "personalSettings",
      value,
    };

    if (id) payload.id = id;
    if (eTag) payload.eTag = eTag;

    apiClient.saveUserSettings(payload, token);
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
      (backupUserData?.name || "") !== (personalSettings?.name || "") ||
      (backupUserData?.surname || "") !== (personalSettings?.surname || "")
    );
  }, [backupUserData, personalSettings]);

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
    key: keyof NotificationSettings,
    type: "email" | "inApp",
    value: boolean
  ) => {
    if (key === "id" || key === "eTag") return;
    setNotifications((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
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
                  isLoading={isLoading}
                  formData={personalSettings}
                  updateFormData={(data) =>
                    setPersonalSettings((prev) => ({ ...prev, ...data }))
                  }
                />
              )}

              {activeTab === "preferences" && (
                <PreferencesSection
                  isLoading={isLoading}
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
