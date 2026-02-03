"use client";

import { Toast } from "@ui/Toast";
import PersonalSettingsSection from "@ui/user/PersonalSettingsSection";
import PreferencesSection from "@ui/user/PreferencesSection";
import RolesPermissionsSection from "@ui/user/RolesPermissionsSection";
import TabsHeader from "@ui/user/TabsHeader";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getLatestUserSetting,
  NOTIFICATION_SETTINGS_KEY,
  type NotificationSettingsValue,
  parseNotificationSettingsValue,
  saveNotificationSettings as persistNotificationSettings,
} from "@/services/notificationSettingsService";

interface UserData {
  id?: string;
  eTag?: string;
  name: string;
  surname: string;
}

interface NotificationSettings extends NotificationSettingsValue {
  id?: string;
  eTag?: string | null;
}

export default function UserProfile() {
  const api = useApi();

  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState<
    "personal" | "notifications" | "roles"
  >("personal");
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [personalSettings, setPersonalSettings] = useState<UserData>({
    name: userData.name,
    surname: userData.surname,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    ...DEFAULT_NOTIFICATION_SETTINGS,
  });
  const [savedNotifications, setSavedNotifications] =
    useState<NotificationSettings>({
      ...DEFAULT_NOTIFICATION_SETTINGS,
    });

  useEffect(() => {
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
        logError("Failed loading user settings", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api.hasToken]);

  async function loadNotificationSettings() {
    if (!api.hasToken) return;
    try {
      const notificationSettings = await api.getUserSettings(
        NOTIFICATION_SETTINGS_KEY,
      );
      if (!notificationSettings || notificationSettings.length === 0) return;
      const latestSettings = getLatestUserSetting(notificationSettings);
      if (!latestSettings) return;
      const parsedValue = parseNotificationSettingsValue(latestSettings.value);
      if (!parsedValue) return;
      const nextSettings = {
        ...parsedValue,
        id: latestSettings.id,
        eTag: latestSettings.eTag,
      };
      setNotifications(nextSettings);
      setSavedNotifications(nextSettings);
    } catch (err) {
      logError("Failed to load notificationSettings", err);
    }
  }

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const resetNotificationState = () => {
    const defaults = { ...DEFAULT_NOTIFICATION_SETTINGS };
    setNotifications(defaults);
    setSavedNotifications(defaults);
  };

  const handleSaveNotificationSettings = () => {
    setIsLoading(true);
    persistNotificationSettings(api, notifications)
      ?.then(({ id, eTag }) => {
        const nextSettings = { ...notifications, id, eTag };
        setNotifications(nextSettings);
        setSavedNotifications(nextSettings);
        showToastMessage("Notification settings saved");
      })
      .catch((error) => {
        logError("Failed to save notification settings", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleResetNotificationSettings = async () => {
    if (!api.hasToken) return;
    setIsLoading(true);
    try {
      await api.deleteUserSettingsByKey(NOTIFICATION_SETTINGS_KEY);
      resetNotificationState();
      showToastMessage("Notification settings reset to defaults");
    } catch (error) {
      logError("Failed to delete notification settings", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSavedSettings = async () => {
    if (!api.hasToken || !notifications.id) return;
    setIsLoading(true);
    try {
      await api.deleteUserSettingsById(notifications.id);
      resetNotificationState();
      showToastMessage("Saved notification settings deleted");
    } catch (error) {
      logError("Failed to delete notification settings by id", error);
    } finally {
      setIsLoading(false);
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

  const stripMeta = (settings: NotificationSettings) => {
    const { id, eTag, ...value } = settings;
    return value;
  };

  const hasNotificationChanges = useMemo(() => {
    return (
      JSON.stringify(stripMeta(savedNotifications)) !==
      JSON.stringify(stripMeta(notifications))
    );
  }, [savedNotifications, notifications]);

  return (
    <>
      <div className="max-w-5xl mx-auto py-4 sm:py-10">
        <div className="flex flex-col gap-6 px-4 sm:px-6">
          <div className="flex items-center">
            <h1 className="text-[32px] font-semibold leading-[140%] text-gray-750">
              Settings
            </h1>
          </div>
          <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <div className="mt-8 px-4 sm:px-6">
          {activeTab === "personal" && (
            <PersonalSettingsSection
              formData={personalSettings}
              userData={userData}
            />
          )}

          {activeTab === "notifications" && (
            <PreferencesSection
              isLoading={isLoading}
              notifications={notifications}
              onEnableAll={handleEnableAll}
              onDisableAll={handleDisableAll}
              onReset={handleResetNotificationSettings}
              onDeleteSaved={handleDeleteSavedSettings}
              onSave={handleSaveNotificationSettings}
              hasSavedSettings={Boolean(notifications.id)}
              hasChanges={hasNotificationChanges}
              updateNotification={updateNotification}
            />
          )}

          {activeTab === "roles" && <RolesPermissionsSection />}
        </div>
      </div>

      <Toast
        message={
          toastMessage || "All your changes has been saved to the system"
        }
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}
