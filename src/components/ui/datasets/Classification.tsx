"use client";

import React, { useState, useEffect } from "react";
import {
  CloudSun,
  Calculator,
  GraduationCap,
  Languages,
  Star,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import HierarchicalDropdown, {
  HierarchicalCategory,
} from "../HierarchicalDropdown";
import { Select } from "../Select";
import { Input } from "../Input";
import { VisibilityCard } from "./VisibilityCard";
import { LicenseCard } from "./LicenseCard";
import { fetchFieldsOfScience, fetchLicenses } from "@/config/filterOptions";
import { useCollections } from "@/contexts/CollectionsContext";
import { Collection, ApiCollection } from "@/types/collection";

interface ClassificationData {
  fieldsOfScience: string[];
  collection: string;
  license: string;
  visibility: "open" | "restricted" | "";
}

interface ClassificationProps {
  data: ClassificationData;
  onChange: (data: ClassificationData) => void;
  errors: {
    fieldsOfScience?: string;
    collection?: string;
    license?: string;
    visibility?: string;
  };
}

// Mock collections data - fallback when API collections are not available
const mockCollections = [
  { value: "weather", label: "Weather Collection" },
  { value: "math", label: "Math Collection" },
  { value: "language", label: "Language Collection" },
  { value: "lifelong", label: "Lifelong Learning Collection" },
];

// Mock licenses with descriptions
const mockLicensesWithDescriptions = [
  {
    value: "cc-by-4.0",
    label: "CC BY 4.0",
    description:
      "This license allows reusers to distribute, remix, adapt, and build upon the material in any medium or format, so long as attribution is given to the creator.",
  },
  {
    value: "cc-by-sa-4.0",
    label: "CC BY-SA 4.0",
    description:
      "This license allows reusers to distribute, remix, adapt, and build upon the material in any medium or format, so long as attribution is given to the creator. The license allows for commercial use. If you remix, adapt, or build upon the material, you must license the modified material under identical terms.",
  },
  {
    value: "mit",
    label: "MIT License",
    description:
      "A short and simple permissive license with conditions only requiring preservation of copyright and license notices.",
  },
  {
    value: "apache-2.0",
    label: "Apache License 2.0",
    description:
      "A permissive license whose main conditions require preservation of copyright and license notices.",
  },
  {
    value: "custom",
    label: "Add Custom License",
    description: "Create a custom license for your dataset.",
  },
];

export function Classification({
  data,
  onChange,
  errors,
}: ClassificationProps) {
  const { data: session } = useSession() as any;
  const { apiCollections, isLoadingApiCollections } = useCollections();
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<
    { value: string; label: string; description?: string; urls?: string[] }[]
  >([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(true);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [customLicenseName, setCustomLicenseName] = useState<string>("");

  // Fetch fields of science and licenses
  useEffect(() => {
    const token = session?.accessToken;

    // Fetch fields of science
    setIsLoadingFields(true);
    fetchFieldsOfScience(token)
      .then((categories) => {
        setFieldsOfScienceCategories(categories);
      })
      .catch((error) => {
        console.error("Error fetching fields of science:", error);
        setFieldsOfScienceCategories([]);
      })
      .finally(() => {
        setIsLoadingFields(false);
      });

    // Fetch licenses
    setIsLoadingLicenses(true);
    fetchLicenses(token)
      .then((licenseOptions) => {
        setLicenses([
          ...licenseOptions,
          { value: "custom", label: "Add Custom License" },
        ]);
      })
      .catch((error) => {
        console.error("Error fetching licenses:", error);
        // Use mock data as fallback
        setLicenses(mockLicensesWithDescriptions);
      })
      .finally(() => {
        setIsLoadingLicenses(false);
      });
  }, [session]);

  const handleFieldChange = (field: keyof ClassificationData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleLicenseChange = (licenseValue: string) => {
    handleFieldChange("license", licenseValue);
    if (licenseValue === "custom") {
      setSelectedLicense(null);
      // Keep previously typed custom name; do not clear automatically
    } else {
      const license = (
        licenses.length ? licenses : mockLicensesWithDescriptions
      ).find((l) => l.value === licenseValue);
      setSelectedLicense(
        license || { value: licenseValue, label: licenseValue }
      );
      // Clear custom name when switching away from custom
      setCustomLicenseName("");
    }
  };

  const getCollectionIcon = (code?: string) => {
    const commonProps = {
      strokeWidth: 1.25,
      className: "w-4 h-4 text-icon",
    } as const;
    if (!code) return <Star {...commonProps} />;
    switch (code.toLowerCase()) {
      case "weather":
      case "meteo":
        return <CloudSun {...commonProps} />;
      case "math":
      case "mathe":
        return <Calculator {...commonProps} />;
      case "lifelong":
      case "learning":
        return <GraduationCap {...commonProps} />;
      case "language":
      case "languages":
        return <Languages {...commonProps} />;
      default:
        return <Star {...commonProps} />;
    }
  };

  // Generate collection options from API collections only
  const generateCollectionOptions = () => {
    const baseOptions = [
      {
        value: "",
        label: "No collection",
        icon: <X strokeWidth={1.25} className="w-4 h-4 text-icon" />,
      },
    ];

    if (isLoadingApiCollections) {
      return baseOptions;
    }

    const collectionOptions = apiCollections.map((collection) => ({
      value: collection.id,
      label: collection.name,
      icon: getCollectionIcon(collection.code),
    }));

    // If no API collections are available, fall back to mock collections
    if (collectionOptions.length === 0) {
      return [
        ...baseOptions,
        ...mockCollections.map((c) => ({
          value: c.value,
          label: c.label.replace(/ Collection$/i, ""),
          icon: getCollectionIcon(c.value),
        })),
      ];
    }

    return [...baseOptions, ...collectionOptions];
  };

  const collectionOptions = generateCollectionOptions();

  const defaultLicenseOptions = licenses
    .filter((l) => l.value !== "custom")
    .map((license) => ({ value: license.value, label: license.label }));

  const groupedLicenseOptions = isLoadingLicenses
    ? []
    : [
        {
          label: "Custom",
          options: [{ value: "custom", label: "Add Custom License" }],
        },
        { label: "Default", options: defaultLicenseOptions },
      ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Field of Science */}
      <div>
        <h4 className="text-body-14-medium sm:text-sm font-medium text-gray-750 mb-1">
          Field of Science *
        </h4>
        {isLoadingFields ? (
          <div className="flex justify-center items-center h-16 sm:h-20">
            <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <HierarchicalDropdown
            value={data.fieldsOfScience}
            onChange={(value) => handleFieldChange("fieldsOfScience", value)}
            categories={fieldsOfScienceCategories}
            placeholder="Search..."
            searchPlaceholder="Search..."
            noOptionsText="No fields of science found"
          />
        )}
        {errors.fieldsOfScience && (
          <p className="mt-1 text-descriptions-12-regular text-red-500">
            {errors.fieldsOfScience}
          </p>
        )}
      </div>

      {/* Collection */}
      <div>
        <h4 className="text-body-14-medium sm:text-sm font-medium text-gray-750 mb-1">
          Collection
        </h4>
        {isLoadingApiCollections ? (
          <div className="flex justify-center items-center h-8 sm:h-10">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Select
            options={collectionOptions}
            value={data.collection}
            onChange={(value) => handleFieldChange("collection", value)}
            placeholder="Select a collection"
            error={errors.collection}
          />
        )}
        {errors.collection && (
          <p className="mt-1 text-descriptions-12-regular text-red-500">
            {errors.collection}
          </p>
        )}
      </div>

      {/* License */}
      <div>
        <Select
          label="License"
          groupedOptions={groupedLicenseOptions}
          value={data.license}
          onChange={handleLicenseChange}
          placeholder="Select a license"
          error={errors.license}
        />

        {data.license === "custom" ? (
          <div className="mt-3">
            <Input
              name="customLicenseName"
              label="Custom License Name *"
              placeholder="Enter custom license name"
              value={customLicenseName}
              onChange={(e) => setCustomLicenseName(e.target.value)}
              error={
                data.license === "custom" && customLicenseName.trim() === ""
                  ? "Custom license name is required"
                  : undefined
              }
            />
          </div>
        ) : (
          selectedLicense && (
            <LicenseCard
              license={selectedLicense}
              primaryUrl={selectedLicense.urls && selectedLicense.urls[0]}
            />
          )
        )}
      </div>

      {/* Visibility */}
      <div>
        <h4 className="text-body-14-medium sm:text-sm font-medium text-gray-750 mb-3">
          Visibility *
        </h4>
        <VisibilityCard
          value={data.visibility}
          onChange={(value) => handleFieldChange("visibility", value)}
        />
        {errors.visibility && (
          <p className="mt-1 text-descriptions-12-regular text-red-500">
            {errors.visibility}
          </p>
        )}
      </div>
    </div>
  );
}
