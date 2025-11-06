"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PersonalSettingsSection from "@/components/ui/user/PersonalSettingsSection";
import PreferencesSection from "@/components/ui/user/PreferencesSection";
import TabsHeader from "@/components/ui/user/TabsHeader";
import UserHeader from "@/components/ui/user/UserHeader";
import { APP_ROUTES } from "@/config/appUrls";
import { useUser } from "@/contexts/UserContext";
import { useApi } from "@/hooks/useApi";
import { Toast } from "./ui/Toast";

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
  const api = useApi();

  const { userData, setProfilePicture } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"personal" | "preferences">(
    "personal",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [personalSettings, setPersonalSettings] = useState<UserData>({
    name: userData.name,
    surname: userData.surname,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    newFeatures: { email: false, inApp: false },
    datasetLibraryChanges: { email: false, inApp: false },
    newDatasets: { email: false, inApp: false },
    systemMaintenance: { email: false, inApp: false },
    systemErrors: { email: false, inApp: false },
  });

  const [backupUserData, setBackupUserData] = useState(userData);
  const [backupNotifications, setBackupNotifications] =
    useState<NotificationSettings>(notifications);

  useEffect(() => {
    setBackupUserData(userData);
    setPersonalSettings({ name: userData.name, surname: userData.surname });
  }, [userData.name, userData.surname, userData]);

  useEffect(() => {
    if (!api.hasToken) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        await loadNotificationSettings();
      } catch (err) {
        console.error("Failed loading user settings:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api.hasToken, loadNotificationSettings]);

  async function loadNotificationSettings() {
    if (!api.hasToken) return;
    try {
      const notificationSettings = await api.getUserSettings(
        "notificationSettings",
      );
      if (!notificationSettings || notificationSettings.length === 0) return;
      const lastIndex = notificationSettings.length - 1;
      setNotifications({
        ...JSON.parse(notificationSettings[lastIndex].value),
        id: notificationSettings[lastIndex].id,
        eTag: notificationSettings[lastIndex].eTag,
      });
      setBackupNotifications({
        ...JSON.parse(notificationSettings[lastIndex].value),
        id: notificationSettings[lastIndex].id,
        eTag: notificationSettings[lastIndex].eTag,
      });
    } catch (err) {
      console.error("Failed to load notificationSettings", err);
    }
  }

  const handleSaveChanges = () => {
    setIsLoading(true);
    saveNotificationSettings()?.then(({ id, eTag }) => {
      setNotifications((prev) => ({ ...prev, id, eTag }));
      setIsLoading(false);
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
    if (!api.hasToken) return;

    // send notification settings with `value` not containing the `id` field
    const { id, eTag, ...value } = notifications as any;
    const payload: any = {
      key: "notificationSettings",
      value,
    };

    if (id) payload.id = id;
    if (eTag) payload.eTag = eTag;

    return api.saveUserSettings(payload, id);
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
    setNotifications((prev) => ({
      ...prev,
      newFeatures: { email: true, inApp: true },
      datasetLibraryChanges: { email: true, inApp: true },
      newDatasets: { email: true, inApp: true },
      systemMaintenance: { email: true, inApp: true },
      systemErrors: { email: true, inApp: true },
    }));
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
    setNotifications((prev) => ({
      ...prev,
      newFeatures: { email: false, inApp: false },
      datasetLibraryChanges: { email: false, inApp: false },
      newDatasets: { email: false, inApp: false },
      systemMaintenance: { email: false, inApp: false },
      systemErrors: { email: false, inApp: false },
    }));
  };

  const updateNotification = (
    key: keyof NotificationSettings,
    type: "email" | "inApp",
    value: boolean,
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
        {hasChanges ? "has unsaved changes" : "has no changes"}
        {isLoading ? "is loading..." : "is not loading"}
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
