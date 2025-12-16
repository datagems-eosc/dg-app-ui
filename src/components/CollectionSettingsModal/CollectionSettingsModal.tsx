"use client";

import { Button } from "@ui/Button";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useCollections } from "@/contexts/CollectionsContext";
import { logError } from "@/lib/logger";
import type { ApiCollection } from "@/types/collection";

interface CollectionSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface CollectionSettings {
  id: string;
  name: string;
  itemCount: number;
  code?: string;
  type: "api" | "extra";
  isVisible: boolean;
  order: number;
}

interface CollectionSettingsItemProps {
  setting: CollectionSettings;
  index: number;
  draggedItem: number | null;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onVisibilityToggle: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

type TypedCollection = ApiCollection & { type: "api" | "extra" };

function buildCollectionsForSettings(
  apiCollections: ApiCollection[],
  extraCollections: ApiCollection[],
): TypedCollection[] {
  const seenIds = new Set<string>();
  const allCollections: TypedCollection[] = [];

  apiCollections.forEach((collection) => {
    if (!collection.id || seenIds.has(collection.id)) return;
    seenIds.add(collection.id);
    allCollections.push({ ...collection, type: "api" });
  });

  extraCollections.forEach((collection) => {
    const hasDatasets = (collection.datasets?.length ?? 0) > 0;
    if (!collection.id || !hasDatasets || seenIds.has(collection.id)) return;
    seenIds.add(collection.id);
    allCollections.push({ ...collection, type: "extra" });
  });

  return allCollections;
}

const CollectionSettingsItem: React.FC<CollectionSettingsItemProps> = ({
  setting,
  index,
  draggedItem,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onVisibilityToggle,
  onMoveUp,
  onMoveDown,
}) => {
  const isVisible = setting.isVisible;
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => {
        onDragOver(e);
        setIsDraggedOver(true);
      }}
      onDragLeave={() => {
        setIsDraggedOver(false);
      }}
      onDrop={(e) => {
        onDrop(e, index);
        setIsDraggedOver(false);
      }}
      onDragEnd={() => {
        onDragEnd();
        setIsDraggedOver(false);
      }}
      className={`px-4 py-2.75 flex items-center gap-2 rounded-lg transition-all duration-200 border border-transparent group ${
        draggedItem === index ? "opacity-60" : ""
      }`}
      style={
        isDraggedOver
          ? { border: "1px dashed #94A3B8", backgroundColor: "#F8FAFC" }
          : undefined
      }
    >
      {/* Drag Handle */}
      <GripVertical
        className={`hidden md:block w-5 h-5 text-icon cursor-move transition-all duration-600 ${
          isVisible ? "text-icon" : "text-slate-450"
        } hover:opacity-100`}
        onMouseEnter={(e) => {
          const container = e.currentTarget.closest(".group");
          if (container instanceof HTMLElement) {
            container.style.opacity = "0.6";
            container.style.border = "1px solid #E2E8F0";
            container.style.boxShadow = "0px 4px 15px 0px #1D293D26";
          }
        }}
        onMouseLeave={(e) => {
          const container = e.currentTarget.closest(".group");
          if (container instanceof HTMLElement) {
            container.style.opacity = "";
            container.style.boxShadow = "";
            container.style.border = "";
          }
        }}
      />

      {/* Collection Icon and Info */}
      <div className="flex items-center gap-3 flex-1">
        <div>
          <div
            className={`text-body-16-semibold ${
              isVisible ? "text-gray-750" : "text-slate-450"
            }`}
          >
            {setting.name}
          </div>
          <div
            className={`text-descriptions-12-regular ${
              isVisible ? "text-icon" : "text-slate-450"
            }`}
          >
            {setting.itemCount} {setting.itemCount === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      {/* Visibility Toggle */}
      {/* Mobile Reorder Controls */}
      <div className="flex items-center gap-1 md:hidden">
        <button
          onClick={() => onMoveUp(index)}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Move up"
        >
          <ChevronUp strokeWidth={1.25} className="w-5 h-5 text-icon" />
        </button>
        <button
          onClick={() => onMoveDown(index)}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Move down"
        >
          <ChevronDown strokeWidth={1.25} className="w-5 h-5 text-icon" />
        </button>
      </div>

      <button
        onClick={() => onVisibilityToggle(index)}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
      >
        {setting.isVisible ? (
          <Eye strokeWidth={1.25} className="w-5 h-5 text-icon" />
        ) : (
          <EyeOff strokeWidth={1.25} className="w-5 h-5 text-icon" />
        )}
      </button>
    </div>
  );
};

export default function CollectionSettingsModal({
  isVisible,
  onClose,
}: CollectionSettingsModalProps) {
  const { apiCollections, extraCollections } = useCollections();
  const [collectionSettings, setCollectionSettings] = useState<
    CollectionSettings[]
  >([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [isInfoVisible, setIsInfoVisible] = useState(true);

  // Initialize collection settings from localStorage or default
  useEffect(() => {
    if (!isVisible) return;

    const allCollections = buildCollectionsForSettings(
      apiCollections,
      extraCollections,
    );

    // Get saved settings from localStorage
    const savedSettings = localStorage.getItem("collectionSettings");
    let savedData: Record<string, { isVisible: boolean; order: number }> = {};

    if (savedSettings) {
      try {
        savedData = JSON.parse(savedSettings);
      } catch (error) {
        logError("Error parsing collection settings", error);
      }
    }

    // Create settings array with saved preferences or defaults
    const settings: CollectionSettings[] = allCollections.map(
      (collection, index) => {
        const saved = savedData[collection.id];
        return {
          id: collection.id,
          name: collection.name.replace(/ Collection$/i, ""),
          itemCount:
            collection.datasetCount || collection.datasets?.length || 0,
          code: collection.code,
          isVisible: saved?.isVisible ?? true,
          type: collection.type,
          order: saved?.order ?? index,
        };
      },
    );

    // Sort by order
    settings.sort((a, b) => a.order - b.order);
    setCollectionSettings(settings);
  }, [isVisible, apiCollections, extraCollections]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null);
      return;
    }

    const newSettings = [...collectionSettings];
    const draggedSetting = newSettings[draggedItem];

    // Remove dragged item
    newSettings.splice(draggedItem, 1);

    // Insert at new position
    newSettings.splice(dropIndex, 0, draggedSetting);

    // Update order values
    const updatedSettings = newSettings.map((setting, index) => ({
      ...setting,
      order: index,
    }));

    setCollectionSettings(updatedSettings);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleVisibilityToggle = (index: number) => {
    const newSettings = [...collectionSettings];
    newSettings[index] = {
      ...newSettings[index],
      isVisible: !newSettings[index].isVisible,
    };
    setCollectionSettings(newSettings);
  };

  const updateOrderValues = (settings: CollectionSettings[]) =>
    settings.map((setting, index) => ({ ...setting, order: index }));

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newSettings = [...collectionSettings];
    const [moved] = newSettings.splice(index, 1);
    newSettings.splice(index - 1, 0, moved);
    setCollectionSettings(updateOrderValues(newSettings));
  };

  const handleMoveDown = (index: number) => {
    if (index >= collectionSettings.length - 1) return;
    const newSettings = [...collectionSettings];
    const [moved] = newSettings.splice(index, 1);
    newSettings.splice(index + 1, 0, moved);
    setCollectionSettings(updateOrderValues(newSettings));
  };

  const handleSave = () => {
    // Save to localStorage
    const settingsData = collectionSettings.reduce(
      (acc, setting) => {
        acc[setting.id] = {
          isVisible: setting.isVisible,
          order: setting.order,
        };
        return acc;
      },
      {} as Record<string, { isVisible: boolean; order: number }>,
    );

    localStorage.setItem("collectionSettings", JSON.stringify(settingsData));

    // Trigger a custom event to notify DashboardLayout of the change
    window.dispatchEvent(new CustomEvent("collectionSettingsChanged"));

    onClose();
  };

  const handleClose = () => {
    setIsInfoVisible(true);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-[95%] md:max-w-[550px] shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.25 border-b border-slate-200">
          <h2 className="text-H6-18-semibold text-slate-850">
            Collections settings
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X strokeWidth={1.25} className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">
          {/* Info Box */}
          {isInfoVisible && (
            <div className="mb-4 px-4 py-2 bg-blue-75 rounded-lg flex items-start gap-3">
              <p className="text-body-14-regular text-blue-650">
                Manage the visibility of your collections and adjust their order
                according to your preferences
              </p>
              <button
                onClick={() => setIsInfoVisible(false)}
                className="p-0.5 hover:bg-blue-100 rounded-md transition-colors"
              >
                <X strokeWidth={1.25} className="w-4 h-4 text-blue-850" />
              </button>
            </div>
          )}

          {/* Collections List */}
          <div className="p-1 border border-slate-350 rounded-lg overflow-auto max-h-[360px]">
            {collectionSettings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-descriptions-12-regular">
                  No collections found.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {collectionSettings.map((setting, index) => (
                  <CollectionSettingsItem
                    key={setting.id}
                    setting={setting}
                    index={index}
                    draggedItem={draggedItem}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onVisibilityToggle={handleVisibilityToggle}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-1 px-6 py-3.75 border-t border-slate-200">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Collections
          </Button>
        </div>
      </div>
    </div>
  );
}
