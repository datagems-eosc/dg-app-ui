"use client";

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
  updateNotification: (
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean,
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
  updateNotification,
  isLoading,
}: Props) {
  const renderSwitch = (
    isOn: boolean,
    onToggle: () => void,
    ariaLabel: string,
  ) => (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={ariaLabel}
      disabled={isLoading}
      onClick={onToggle}
      className={`flex items-center w-7 h-4 rounded-full p-[2px] transition-colors ${
        isOn ? "bg-[#052F4A] justify-end" : "bg-slate-200 justify-start"
      } ${isLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="bg-white w-3 h-3 rounded-full shadow-[0px_0.6px_0.6px_0px_rgba(213,218,227,0.3)]" />
    </button>
  );

  return (
    <div className="bg-white rounded-2xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:h-12 border-b border-slate-200 py-2 sm:py-0">
        <div className="flex-1 text-[16px] font-semibold leading-[150%] text-gray-750">
          Group permissions
        </div>
        <div className="hidden sm:flex w-40 text-[14px] font-normal leading-[150%] text-gray-750 text-center justify-center">
          E-mail
        </div>
        <div className="hidden sm:flex w-40 text-[14px] font-normal leading-[150%] text-gray-750 text-center justify-center">
          In App
        </div>
      </div>
      {NOTIFICATION_ITEMS.map((item, index) => (
        <div
          key={item.key}
          className={`flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:h-[72px] ${
            index < NOTIFICATION_ITEMS.length - 1
              ? "border-b border-slate-200"
              : ""
          }`}
        >
          <div className="flex-1">
            <div className="text-[14px] font-medium leading-[150%] text-gray-750">
              {item.title}
            </div>
            <div className="text-[12px] leading-[150%] text-gray-650 tracking-[0.12px]">
              {item.description}
            </div>
          </div>
          <div className="w-full sm:w-40 flex items-center gap-3 sm:justify-center">
            <span className="text-[14px] text-gray-750 sm:hidden">E-mail</span>
            {renderSwitch(
              notifications[item.key].email,
              () =>
                updateNotification(
                  item.key,
                  "email",
                  !notifications[item.key].email,
                ),
              `${item.title} email`,
            )}
          </div>
          <div className="w-full sm:w-40 flex items-center gap-3 sm:justify-center">
            <span className="text-[14px] text-gray-750 sm:hidden">In App</span>
            {renderSwitch(
              notifications[item.key].inApp,
              () =>
                updateNotification(
                  item.key,
                  "inApp",
                  !notifications[item.key].inApp,
                ),
              `${item.title} in app`,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
