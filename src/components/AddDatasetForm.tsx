"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";
import { DatasetUpload } from "./ui/datasets/DatasetUpload";
import { BasicInformation } from "./ui/datasets/BasicInformation";
import { Classification } from "./ui/datasets/Classification";
import { AdditionalInformation } from "./ui/datasets/AdditionalInformation";
import { FormSectionLayout } from "./ui/FormSectionLayout";
import { APP_ROUTES } from "@/config/appUrls";
import { apiClient } from "@/lib/apiClient";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface FormData {
  files: UploadedFile[];
  basicInfo: {
    title: string;
    headline: string;
    description: string;
    keywords: string[];
  };
  classification: {
    fieldsOfScience: string[];
    collection: string;
    license: string;
    visibility: "open" | "restricted" | "";
  };
  additionalInfo: {
    referenceString: string;
    sourceLink: string;
  };
}

interface FormErrors {
  files?: string;
  basicInfo: {
    title?: string;
    headline?: string;
    description?: string;
    keywords?: string;
  };
  classification: {
    fieldsOfScience?: string;
    collection?: string;
    license?: string;
    visibility?: string;
  };
  additionalInfo: {
    referenceString?: string;
    sourceLink?: string;
  };
}

const initialFormData: FormData = {
  files: [],
  basicInfo: {
    title: "",
    headline: "",
    description: "",
    keywords: [],
  },
  classification: {
    fieldsOfScience: [],
    collection: "",
    license: "",
    visibility: "",
  },
  additionalInfo: {
    referenceString: "",
    sourceLink: "",
  },
};

const initialErrors: FormErrors = {
  basicInfo: {},
  classification: {},
  additionalInfo: {},
};

export default function AddDatasetForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      basicInfo: {},
      classification: {},
      additionalInfo: {},
    };

    // Validate files
    if (formData.files.length === 0) {
      newErrors.files = "At least one file must be uploaded";
    }

    // Validate basic information
    if (!formData.basicInfo.title.trim()) {
      newErrors.basicInfo.title = "Title is required";
    }

    if (!formData.basicInfo.headline.trim()) {
      newErrors.basicInfo.headline = "Headline is required";
    } else if (formData.basicInfo.headline.length > 150) {
      newErrors.basicInfo.headline = "Headline must be 150 characters or less";
    }

    if (formData.basicInfo.description.length > 3000) {
      newErrors.basicInfo.description =
        "Description must be 3000 characters or less";
    }

    // Validate keywords: required and max combined length 250
    const combinedKeywords = formData.basicInfo.keywords
      .filter(Boolean)
      .join(", ");
    if (formData.basicInfo.keywords.length === 0) {
      newErrors.basicInfo.keywords = "Keywords are required";
    } else if (combinedKeywords.length > 250) {
      newErrors.basicInfo.keywords = "Keywords must be 250 characters or less";
    }

    // Validate classification
    if (formData.classification.fieldsOfScience.length === 0) {
      newErrors.classification.fieldsOfScience =
        "At least one field of science must be selected";
    }

    if (!formData.classification.visibility) {
      newErrors.classification.visibility =
        "Visibility option must be selected";
    }

    // Validate additional information
    if (formData.additionalInfo.referenceString.length > 3000) {
      newErrors.additionalInfo.referenceString =
        "Reference string must be 3000 characters or less";
    }

    if (
      formData.additionalInfo.sourceLink &&
      !isValidUrl(formData.additionalInfo.sourceLink)
    ) {
      newErrors.additionalInfo.sourceLink = "Please enter a valid URL";
    }

    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors =
      !!newErrors.files ||
      Object.values(newErrors.basicInfo).some((error) => error) ||
      Object.values(newErrors.classification).some((error) => error) ||
      Object.values(newErrors.additionalInfo).some((error) => error);

    return !hasErrors;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        throw new Error("No access token available");
      }

      const files = formData.files || [];
      const sizes = files.map((f) => f.size).filter((n) => Number.isFinite(n));
      const sizeRange =
        sizes.length > 0
          ? { start: Math.min(...sizes), end: Math.max(...sizes) }
          : undefined;

      const mimeTypes = files.map((f) => f.type).filter(Boolean);

      const likeTerms = [
        formData.basicInfo.title,
        formData.basicInfo.headline,
        formData.basicInfo.description,
        ...(formData.basicInfo.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const payload: any = {
        like: likeTerms || undefined,
        license: formData.classification.license || undefined,
        mimeType: mimeTypes[0] || undefined,
        fieldsOfScience: formData.classification.fieldsOfScience?.length
          ? formData.classification.fieldsOfScience
          : undefined,
        sizeRange,
        page: { offset: 0, size: 10 },
      };

      if (formData.classification.collection) {
        payload.collectionIds = [formData.classification.collection];
      }

      const response = await apiClient.queryDatasets(payload, token);

      console.log("/dataset/query response", response);
      alert("Dataset submitted successfully!");

      setFormData(initialFormData);
      setErrors(initialErrors);
    } catch (error) {
      console.error("Error submitting dataset:", error);
      alert("Error submitting dataset. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilesChange = (files: UploadedFile[]) => {
    setFormData((prev) => ({ ...prev, files }));
    // Clear file error if files are added
    if (files.length > 0 && errors.files) {
      setErrors((prev) => ({ ...prev, files: undefined }));
    }
  };

  const handleBasicInfoChange = (basicInfo: FormData["basicInfo"]) => {
    setFormData((prev) => ({ ...prev, basicInfo }));
  };

  const handleClassificationChange = (
    classification: FormData["classification"]
  ) => {
    setFormData((prev) => ({ ...prev, classification }));
  };

  const handleAdditionalInfoChange = (
    additionalInfo: FormData["additionalInfo"]
  ) => {
    setFormData((prev) => ({ ...prev, additionalInfo }));
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6 sm:space-y-8">
        {[
          {
            key: "upload",
            title: "Dataset upload",
            description: "Upload the files of your dataset",
            content: (
              <DatasetUpload
                files={formData.files}
                onFilesChange={handleFilesChange}
              />
            ),
            errorText: errors.files,
          },
          {
            key: "basic",
            title: "Basic information",
            description: "Provide the essential details about your dataset",
            content: (
              <BasicInformation
                data={formData.basicInfo}
                onChange={handleBasicInfoChange}
                errors={errors.basicInfo}
              />
            ),
          },
          {
            key: "classification",
            title: "Classification",
            description: "Categorize your dataset for better discoverability",
            content: (
              <Classification
                data={formData.classification}
                onChange={handleClassificationChange}
                errors={errors.classification}
              />
            ),
          },
          {
            key: "additional",
            title: "Additional Information",
            description: "Dataset citation",
            content: (
              <AdditionalInformation
                data={formData.additionalInfo}
                onChange={handleAdditionalInfoChange}
                errors={errors.additionalInfo}
              />
            ),
          },
        ].map((section) => (
          <FormSectionLayout
            key={section.key}
            title={section.title}
            description={section.description}
            errorText={section.errorText}
          >
            {section.content}
          </FormSectionLayout>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(APP_ROUTES.DASHBOARD)}
          className="w-full sm:w-auto order-2 sm:order-1"
        >
          Cancel
        </Button>
        <Tooltip content="Publishing is not implemented yet." position="top">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 sm:px-8 order-1 sm:order-2"
          >
            {isSubmitting ? "Submitting..." : "Publish Dataset"}
          </Button>
        </Tooltip>
      </div>
    </form>
  );
}
