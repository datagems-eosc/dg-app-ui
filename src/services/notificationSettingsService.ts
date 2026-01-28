import type { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import type { UserSettings, UserSettingsPersist } from "@/types/userSettings";

export const NOTIFICATION_SETTINGS_KEY = "notificationSettings";

export type NotificationSettingsValue = {
  newFeatures: { email: boolean; inApp: boolean };
  datasetLibraryChanges: { email: boolean; inApp: boolean };
  newDatasets: { email: boolean; inApp: boolean };
  systemMaintenance: { email: boolean; inApp: boolean };
  systemErrors: { email: boolean; inApp: boolean };
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsValue = {
  newFeatures: { email: false, inApp: false },
  datasetLibraryChanges: { email: false, inApp: false },
  newDatasets: { email: false, inApp: false },
  systemMaintenance: { email: false, inApp: false },
  systemErrors: { email: false, inApp: false },
};

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isNotificationToggle = (
  value: unknown,
): value is { email: boolean; inApp: boolean } => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isBoolean(candidate.email) && isBoolean(candidate.inApp);
};

export const validateNotificationSettingsValue = (
  value: unknown,
): value is NotificationSettingsValue => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNotificationToggle(candidate.newFeatures) &&
    isNotificationToggle(candidate.datasetLibraryChanges) &&
    isNotificationToggle(candidate.newDatasets) &&
    isNotificationToggle(candidate.systemMaintenance) &&
    isNotificationToggle(candidate.systemErrors)
  );
};

export const parseNotificationSettingsValue = (
  value: string | null | undefined,
): NotificationSettingsValue | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!validateNotificationSettingsValue(parsed)) return null;
    return parsed;
  } catch (error) {
    logError("Failed to parse notification settings value", error);
    return null;
  }
};

export const getLatestUserSetting = (settings: UserSettings[]) => {
  if (settings.length === 0) return null;
  const withTimestamps = settings.filter(
    (setting) => setting.updatedAt || setting.createdAt,
  );
  if (withTimestamps.length === 0) {
    return settings[settings.length - 1];
  }
  return withTimestamps.slice().sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  })[0];
};

export const buildNotificationSettingsPayload = (
  settings: NotificationSettingsValue & { id?: string; eTag?: string | null },
): {
  key: string;
  value: NotificationSettingsValue;
  id?: string;
  eTag?: string | null;
} => {
  const { id, eTag, ...value } = settings;
  return {
    key: NOTIFICATION_SETTINGS_KEY,
    value,
    id,
    eTag,
  };
};

export const saveNotificationSettings = async (
  api: ReturnType<typeof useApi>,
  settings: NotificationSettingsValue & { id?: string; eTag?: string | null },
) => {
  if (!validateNotificationSettingsValue(settings)) {
    throw new Error("Invalid notification settings schema");
  }
  const payload = buildNotificationSettingsPayload(settings);
  return api.saveUserSettings(payload, settings.id);
};
