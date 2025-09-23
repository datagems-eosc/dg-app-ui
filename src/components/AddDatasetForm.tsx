"use client";

import React, { useState } from "react";
import { Button } from "./ui/Button";
import { DatasetUpload } from "./ui/datasets/DatasetUpload";
import { BasicInformation } from "./ui/datasets/BasicInformation";
import { Classification } from "./ui/datasets/Classification";
import { AdditionalInformation } from "./ui/datasets/AdditionalInformation";
import { FormSectionLayout } from "./ui/FormSectionLayout";

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
      // Mock API call - in real implementation, this would call the backend
      console.log("Submitting dataset:", formData);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock success response
      alert("Dataset submitted successfully!");

      // Reset form
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
    <form onSubmit={handleSubmit} className="space-y-8">
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

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting} className="px-8">
          {isSubmitting ? "Submitting..." : "Submit Dataset"}
        </Button>
      </div>
    </form>
  );
}
