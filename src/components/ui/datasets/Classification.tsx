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
import { VisibilityCard } from "./VisibilityCard";
import { LicenseCard } from "./LicenseCard";
import { fetchFieldsOfScience, fetchLicenses } from "@/config/filterOptions";

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

// Mock collections data - in real app this would come from API
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
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<{ value: string; label: string }[]>(
    []
  );
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(true);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);

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
    const license = mockLicensesWithDescriptions.find(
      (l) => l.value === licenseValue
    );
    setSelectedLicense(license);
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

  const collectionOptions = [
    {
      value: "",
      label: "No collection",
      icon: <X strokeWidth={1.25} className="w-4 h-4 text-icon" />,
    },
    ...mockCollections.map((c) => ({
      value: c.value,
      label: c.label.replace(/ Collection$/i, ""),
      icon: getCollectionIcon(c.value),
    })),
  ];

  const licenseOptions = isLoadingLicenses
    ? []
    : licenses.map((license) => ({
        value: license.value,
        label: license.label,
      }));

  return (
    <div className="space-y-6">
      {/* Field of Science */}
      <div>
        <h4 className="text-sm font-medium text-gray-750 mb-1">
          Field of Science *
        </h4>
        {isLoadingFields ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
      <Select
        label="Collection"
        options={collectionOptions}
        value={data.collection}
        onChange={(value) => handleFieldChange("collection", value)}
        placeholder="Select a collection"
        error={errors.collection}
      />

      {/* License */}
      <div>
        <Select
          label="License"
          options={licenseOptions}
          value={data.license}
          onChange={handleLicenseChange}
          placeholder="Select a license"
          error={errors.license}
        />

        {selectedLicense && selectedLicense.description && (
          <LicenseCard license={selectedLicense} />
        )}
      </div>

      {/* Visibility */}
      <div>
        <h4 className="text-sm font-medium text-gray-750 mb-3">Visibility *</h4>
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
