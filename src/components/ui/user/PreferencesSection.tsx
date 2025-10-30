"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

type NotificationSettings = {
  newFeatures: { email: boolean; inApp: boolean };
  datasetLibraryChanges: { email: boolean; inApp: boolean };
  newDatasets: { email: boolean; inApp: boolean };
  systemMaintenance: { email: boolean; inApp: boolean };
  systemErrors: { email: boolean; inApp: boolean };
};

type NotificationCategory =
  | "newFeatures"
  | "datasetLibraryChanges"
  | "newDatasets"
  | "systemMaintenance"
  | "systemErrors";

interface Props {
  notifications: NotificationSettings;
  onEnableAll: () => void;
  onDisableAll: () => void;
  updateNotification: (
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean
  ) => void;
  isLoading: boolean;
}

const NOTIFICATION_ITEMS: Array<{
  key: NotificationCategory;
  title: string;
  description: string;
}> = [
    {
      key: "newFeatures",
      title: "New Features",
      description: "Get notified when new features are added to the platform",
    },
    {
      key: "datasetLibraryChanges",
      title: "Dataset Library Changes",
      description: "Receive updates about changes to the datasets library",
    },
    {
      key: "newDatasets",
      title: "New Datasets",
      description: "Be informed when new datasets are added to the system",
    },
    {
      key: "systemMaintenance",
      title: "System Maintenance",
      description: "Get notified about planned system maintenance",
    },
    {
      key: "systemErrors",
      title: "System Errors",
      description:
        "Receive alerts about errors affecting your data or collections",
    },
  ];

export default function PreferencesSection({
  notifications,
  onEnableAll,
  onDisableAll,
  updateNotification,
  isLoading,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-6 sm:pb-8">
          <div className="flex flex-col gap-1 items-start justify-start">
            <h2 className="text-H2-20-semibold text-gray-750">
              Notification Preferences
            </h2>
            <p className="text-body-14-regular text-gray-650">
              Choose how you want to be notified about updates and changes
            </p>
          </div>
          <div className="flex gap-2 self-end sm:self-auto sm:ml-auto">
            <Button variant="outline" size="sm" onClick={onEnableAll}>
              Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={onDisableAll}>
              Disable All
            </Button>
          </div>
        </div>

        <div>
          {NOTIFICATION_ITEMS.map((item, index, arr) => (
            <div
              key={item.key}
              className={`grid grid-cols-1 sm:grid-cols-[38%_31%_31%] gap-4 items-start sm:items-center justify-items-start sm:justify-items-center py-6 sm:py-8 ${index < arr.length - 1 ? "border-b border-slate-200" : "pb-0"}`}
            >
              <div className="space-y-1 justify-self-start text-left">
                <h3 className="text-body-16-medium text-gray-750">
                  {item.title}
                </h3>
                <p className="text-descriptions-12-regular text-gray-650">
                  {item.description}
                </p>
              </div>
              <div className="justify-self-start sm:justify-self-center">
                <Checkbox
                  disabled={isLoading}
                  id={`${item.key}-email`}
                  label="E-mail"
                  checked={notifications[item.key].email}
                  onChange={(checked) =>
                    updateNotification(item.key, "email", checked)
                  }
                />
              </div>
              <div className="justify-self-start sm:justify-self-center">
                <Checkbox
                  disabled={isLoading}
                  id={`${item.key}-app`}
                  label="In App"
                  checked={notifications[item.key].inApp}
                  onChange={(checked) =>
                    updateNotification(item.key, "inApp", checked)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
