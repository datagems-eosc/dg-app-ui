"use client";

import PersonalSettingsSection from "@ui/user/PersonalSettingsSection";
import PreferencesSection from "@ui/user/PreferencesSection";
import RolesPermissionsSection from "@ui/user/RolesPermissionsSection";
import TabsHeader from "@ui/user/TabsHeader";
import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";

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

  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState<
    "personal" | "notifications" | "roles"
  >("personal");
  const [isLoading, setIsLoading] = useState(true);
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
    } catch (err) {
      logError("Failed to load notificationSettings", err);
    }
  }

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
              updateNotification={updateNotification}
            />
          )}

          {activeTab === "roles" && <RolesPermissionsSection />}
        </div>
      </div>
    </>
  );
}
