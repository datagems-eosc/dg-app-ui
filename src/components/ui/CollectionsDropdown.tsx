"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  PackagePlus,
  CloudSun,
  Calculator,
  GraduationCap,
  Languages,
  Star,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Collection, ApiCollection } from "@/types/collection";

interface CollectionsDropdownProps {
  collections: {
    apiCollections: Collection[];
    collections: Collection[];
    extraCollections: ApiCollection[];
    isLoading: boolean;
  };
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection | null) => void;
  disabled?: boolean;
}

interface CollectionItemProps {
  collection: Collection | ApiCollection | null;
  isSelected: boolean;
  onClick: () => void;
  isCustom?: boolean;
}

const getCollectionIcon = (code?: string, className?: string) => {
  const baseClasses = "w-4 h-4 text-icon";
  const finalClasses = className ? `${baseClasses} ${className}` : baseClasses;

  if (!code) return <Star strokeWidth={1.25} className={finalClasses} />;

  switch (code.toLowerCase()) {
    case "weather":
    case "meteo":
      return <CloudSun strokeWidth={1.25} className={finalClasses} />;
    case "math":
    case "mathe":
      return <Calculator strokeWidth={1.25} className={finalClasses} />;
    case "lifelong":
    case "learning":
      return <GraduationCap strokeWidth={1.25} className={finalClasses} />;
    case "language":
    case "languages":
      return <Languages strokeWidth={1.25} className={finalClasses} />;
    default:
      return <Star strokeWidth={1.25} className={finalClasses} />;
  }
};

const CollectionItem = ({
  collection,
  isSelected,
  onClick,
  isCustom = false,
}: CollectionItemProps) => {
  const getDatasetCount = (collection: Collection | ApiCollection) => {
    if (
      isCustom &&
      "userDatasetCollections" in collection &&
      collection.userDatasetCollections?.length
    ) {
      return collection.userDatasetCollections.length;
    }
    return collection.datasetCount || collection.datasetIds?.length || 0;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center px-3 py-1 rounded-md cursor-pointer transition-colors group mb-1",
        isSelected ? "bg-slate-200" : "hover:bg-slate-100"
      )}
    >
      {!!collection && getCollectionIcon(collection.code, "mr-3")}
      <span className="flex-1 truncate text-body-14-regular text-slate-950">
        {!collection
          ? "No collection"
          : isCustom
            ? collection.name
            : collection.name.replace(/ Collection$/i, "")}
      </span>
      {!!collection && (
        <span className="inline-flex items-center justify-center w-4 h-4 text-descriptions-12-medium text-blue-800 bg-blue-75 group-hover:bg-white tracking-1p rounded-full ml-2 py-3 px-4 transition-colors">
          {getDatasetCount(collection)}
        </span>
      )}
    </div>
  );
};

export function CollectionsDropdown({
  collections,
  selectedCollection,
  onSelectCollection,
  disabled = false,
}: CollectionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedInsideTrigger = dropdownRef.current?.contains(target);
      const clickedInsidePortal = portalRef.current?.contains(target);
      if (!clickedInsideTrigger && !clickedInsidePortal) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recalculate dropdown position when opened and on resize/scroll
  useEffect(() => {
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = 256; // w-64
      const horizontalPadding = 8;
      const verticalGap = 8;

      // Right-align to trigger; clamp within viewport
      let left = rect.right - width;
      left = Math.max(
        horizontalPadding,
        Math.min(left, viewportWidth - width - horizontalPadding)
      );

      // Always render above the button with a fixed gap; translateY(-100%) handles height
      const top = rect.top - verticalGap;

      setPortalPosition({ top, left, width });
    };

    if (isOpen) {
      updatePosition();
      const id = requestAnimationFrame(updatePosition);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen]);

  const handleSelect = (collection: Collection | null) => {
    onSelectCollection(collection);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div ref={triggerRef} className="inline-block">
        <Button
          variant="outline"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          {selectedCollection ? (
            getCollectionIcon(selectedCollection.code)
          ) : (
            <PackagePlus strokeWidth={1.25} className="w-4 h-4 text-icon" />
          )}
          <span className="truncate max-w-32">
            {selectedCollection
              ? selectedCollection.name.replace(/ Collection$/i, "")
              : "Collections"}
          </span>
        </Button>
      </div>

      {isOpen &&
        portalPosition &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed bg-white rounded-lg shadow-lg border border-slate-200 z-[1000] max-h-96 overflow-y-auto will-change-transform"
            style={{
              top: portalPosition.top,
              left: portalPosition.left,
              width: portalPosition.width,
              transform: "translateY(-100%)",
            }}
          >
            {/* No Collection Option */}
            <div className="p-1">
              <CollectionItem
                collection={null}
                isSelected={!selectedCollection}
                onClick={() => handleSelect(null)}
              />
            </div>

            {/* Default Collections */}
            {!collections.isLoading &&
              collections.apiCollections.length > 0 && (
                <div className="px-1">
                  <div className="text-descriptions-12-medium text-slate-450 uppercase !tracking-wider m-2">
                    Default
                  </div>
                  {collections.apiCollections.map((collection) => (
                    <CollectionItem
                      key={collection.id}
                      collection={collection}
                      isSelected={selectedCollection?.id === collection.id}
                      onClick={() => handleSelect(collection)}
                    />
                  ))}
                </div>
              )}

            {/* Extra Collections (User Collections from API) */}
            {collections.extraCollections.filter(
              (collection) => collection.userDatasetCollections?.length > 0
            ).length > 0 && (
              <div className="px-1 pt-2">
                <div className="text-descriptions-12-medium text-slate-450 uppercase !tracking-wider mb-2 ml-2">
                  Custom
                </div>
                {collections.extraCollections
                  .filter(
                    (collection) =>
                      collection.userDatasetCollections?.length > 0
                  )
                  .map((collection) => (
                    <CollectionItem
                      key={collection.id}
                      collection={collection}
                      isSelected={selectedCollection?.id === collection.id}
                      onClick={() => handleSelect(collection)}
                      isCustom={true}
                    />
                  ))}
              </div>
            )}

            {/* Loading State */}
            {collections.isLoading && (
              <div className="px-3 py-2">
                <div className="flex items-center px-3 py-2 text-gray-500">
                  <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  Loading collections...
                </div>
              </div>
            )}

            {/* Empty State */}
            {!collections.isLoading &&
              collections.apiCollections.length === 0 &&
              collections.collections.length === 0 &&
              collections.extraCollections.filter(
                (collection) => collection.userDatasetCollections?.length > 0
              ).length === 0 && (
                <div className="px-3 py-2">
                  <div className="text-center text-gray-400 text-sm py-4">
                    No collections available
                  </div>
                </div>
              )}
          </div>,
          document.body
        )}
    </div>
  );
}
