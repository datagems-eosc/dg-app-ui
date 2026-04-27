"use client";

import { Button } from "@ui/Button";
import { AdditionalInformation } from "@ui/datasets/AdditionalInformation";
import { BasicInformation } from "@ui/datasets/BasicInformation";
import { Classification } from "@ui/datasets/Classification";
import { DatasetUpload, type UploadedFile } from "@ui/datasets/DatasetUpload";
import { FormSectionLayout } from "@ui/FormSectionLayout";
import { SuccessModal } from "@ui/SuccessModal";
import { Toast } from "@ui/Toast";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import type { PermissionKey } from "@/config/contextGrantRoles";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import { useApi } from "@/hooks/useApi";
import { ApiErrorMessage } from "@/lib/apiErrors";
import { logError } from "@/lib/logger";
import { slugify } from "@/lib/slugify";
import { getNavigationUrl } from "@/lib/utils";
import type { AccessType, GroupPermissionRow } from "./AddDatasetShareStep";
import AddDatasetShareStep from "./AddDatasetShareStep";

interface FormData {
  files: UploadedFile[];
  basicInfo: {
    title: string;
    headline: string;
    description: string;
    keywords: string[];
    authors: string;
  };
  classification: {
    fieldsOfScience: string[];
    collection: string;
    license: string;
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
    authors?: string;
  };
  classification: {
    fieldsOfScience?: string;
    collection?: string;
    license?: string;
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
    authors: "",
  },
  classification: {
    fieldsOfScience: [],
    collection: "",
    license: "",
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

const AUTHORS_MAX_LENGTH = 250;

// data-flows.md: staged files use Kind 0 (File) with the path returned by upload.
// Backend expects /storage/datagems/gw/dataset_upload\<filename> format (Postman).
const DATA_LOCATION_KIND_FILE = 0;
const DATA_STORE_KIND_FILESYSTEM = 0;
/** Single delay before profile to allow backend propagation. No retry storm. */
const PROFILE_INITIAL_DELAY_MS = 2000;

export default function AddDatasetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const datasetIdForEdit = searchParams.get("datasetId");
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([]);
  const [, setIsEditLoading] = useState(Boolean(datasetIdForEdit));
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    type: "success" | "error";
  }>({ message: "", visible: false, type: "success" });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [accessType, setAccessType] = useState<AccessType>("public");
  const [groupPermissions, setGroupPermissions] = useState<
    GroupPermissionRow[]
  >([]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, visible: true, type });
    },
    [],
  );

  const hasToken = api.hasToken;
  const getUploadAllowedExtensions = api.getUploadAllowedExtensions;
  const queryDatasets = api.queryDatasets;

  const wait = useCallback(
    (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    [],
  );

  const isDatasetNotFoundError = useCallback((error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return msg.includes("dataset not found") || msg.includes("not found");
  }, []);

  const resolveDatasetIdByName = useCallback(
    async (name: string): Promise<string | null> => {
      if (!name.trim()) return null;
      const response = await queryDatasets({
        like: `%${name}%`,
        project: { fields: ["id", "code", "name"] },
        page: { Offset: 0, Size: 50 },
        Order: { Items: ["-datePublished"] },
        Metadata: { CountAll: false },
      });

      const items = Array.isArray(response?.items) ? response.items : [];
      const exactMatch = items.find((item: Record<string, unknown>) => {
        const itemName =
          typeof item?.name === "string"
            ? item.name
            : typeof item?.Name === "string"
              ? item.Name
              : "";
        return itemName.trim().toLowerCase() === name.trim().toLowerCase();
      });

      const idCandidate =
        (exactMatch?.id as string | undefined) ??
        (exactMatch?.Id as string | undefined) ??
        (items[0]?.id as string | undefined) ??
        (items[0]?.Id as string | undefined);

      return typeof idCandidate === "string" && idCandidate.trim()
        ? idCandidate
        : null;
    },
    [queryDatasets],
  );

  const resolveDatasetIdById = useCallback(
    async (id: string): Promise<string | null> => {
      if (!id.trim()) return null;
      const response = await queryDatasets({
        ids: [id],
        project: { fields: ["id"] },
        page: { Offset: 0, Size: 1 },
        Order: { Items: ["+id"] },
        Metadata: { CountAll: false },
      });

      const items = Array.isArray(response?.items) ? response.items : [];
      const first = items[0] as { id?: unknown; Id?: unknown } | undefined;
      const candidate =
        typeof first?.id === "string"
          ? first.id
          : typeof first?.Id === "string"
            ? first.Id
            : "";

      return candidate.trim() ? candidate : null;
    },
    [queryDatasets],
  );

  const profileAndResolveDatasetId = useCallback(
    async (datasetId: string, datasetName: string): Promise<string | null> => {
      await wait(PROFILE_INITIAL_DELAY_MS);

      try {
        await api.profileDataset(datasetId, DATA_STORE_KIND_FILESYSTEM);
        return datasetId;
      } catch (error) {
        if (!isDatasetNotFoundError(error)) throw error;
      }

      const byId = await resolveDatasetIdById(datasetId);
      if (byId) {
        try {
          await api.profileDataset(byId, DATA_STORE_KIND_FILESYSTEM);
        } catch {
          /* ignore profile 404 */
        }
        return byId;
      }

      const byName = await resolveDatasetIdByName(datasetName);
      if (byName) {
        try {
          await api.profileDataset(byName, DATA_STORE_KIND_FILESYSTEM);
        } catch {
          /* ignore profile 404 */
        }
        return byName;
      }

      return null;
    },
    [
      api,
      isDatasetNotFoundError,
      resolveDatasetIdById,
      resolveDatasetIdByName,
      wait,
    ],
  );

  useEffect(() => {
    if (!hasToken) return;
    getUploadAllowedExtensions()
      .then(setAllowedExtensions)
      .catch(() => setAllowedExtensions([]));
  }, [hasToken, getUploadAllowedExtensions]);

  useEffect(() => {
    if (!datasetIdForEdit || !hasToken || !queryDatasets) return;
    let cancelled = false;
    setIsEditLoading(true);
    queryDatasets({
      ids: [datasetIdForEdit],
      project: {
        fields: [
          "id",
          "name",
          "description",
          "headline",
          "keywords",
          "fieldOfScience",
          "license",
          "collections.id",
          "url",
          "citation",
        ],
      },
      page: { Offset: 0, Size: 1 },
      Order: { Items: ["+name"] },
      Metadata: { CountAll: false },
    })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res.items) ? res.items : [];
        const item = items[0] as Record<string, unknown> | undefined;
        if (!item) return;
        const name = String(item.name ?? item.code ?? "");
        const description = String(item.description ?? "");
        const headline = String(item.headline ?? "");
        const keywords = Array.isArray(item.keywords)
          ? (item.keywords as string[])
          : typeof item.keywords === "string"
            ? [item.keywords]
            : [];
        const fieldOfScience = Array.isArray(item.fieldOfScience)
          ? (item.fieldOfScience as string[])
          : typeof item.fieldOfScience === "string"
            ? [item.fieldOfScience]
            : [];
        const license = String(item.license ?? "");
        const collections = Array.isArray(item.collections)
          ? (item.collections as Array<{ id?: string }>)
          : [];
        const collection = collections[0]?.id != null ? collections[0].id : "";
        const url = String(item.url ?? "");
        const citeAs = String(
          (item as { citation?: string }).citation ?? item.citeAs ?? "",
        );
        setFormData((prev) => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            title: name,
            headline: headline || name,
            description,
            keywords,
            authors: prev.basicInfo.authors,
          },
          classification: {
            ...prev.classification,
            fieldsOfScience: fieldOfScience,
            collection,
            license,
          },
          additionalInfo: {
            sourceLink: url,
            referenceString: citeAs,
          },
        }));
      })
      .catch((err) => {
        if (!cancelled) logError("Failed to load dataset for edit", err);
      })
      .finally(() => {
        if (!cancelled) setIsEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetIdForEdit, hasToken, queryDatasets]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      basicInfo: {},
      classification: {},
      additionalInfo: {},
    };

    if (!datasetIdForEdit && formData.files.length === 0) {
      newErrors.files = "At least one file must be uploaded";
    }

    if (!formData.basicInfo.title.trim()) {
      newErrors.basicInfo.title = "Title is required";
    }

    if (!formData.basicInfo.headline.trim()) {
      newErrors.basicInfo.headline = "Headline is required";
    } else if (formData.basicInfo.headline.length > 150) {
      newErrors.basicInfo.headline = "Headline must be 150 characters or less";
    }

    if (!formData.basicInfo.description.trim()) {
      newErrors.basicInfo.description = "Description is required";
    } else if (formData.basicInfo.description.length > 3000) {
      newErrors.basicInfo.description =
        "Description must be 3000 characters or less";
    }

    if (formData.basicInfo.authors.length > AUTHORS_MAX_LENGTH) {
      newErrors.basicInfo.authors = `Authors must be ${AUTHORS_MAX_LENGTH} characters or less`;
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

    if (formData.classification.fieldsOfScience.length === 0) {
      newErrors.classification.fieldsOfScience =
        "At least one field of science must be selected";
    }

    if (!formData.classification.license.trim()) {
      newErrors.classification.license = "License is required";
    }

    if (!formData.additionalInfo.referenceString.trim()) {
      newErrors.additionalInfo.referenceString =
        "Reference string (citation) is required";
    } else if (formData.additionalInfo.referenceString.length > 3000) {
      newErrors.additionalInfo.referenceString =
        "Reference string must be 3000 characters or less";
    }

    if (!formData.additionalInfo.sourceLink.trim()) {
      newErrors.additionalInfo.sourceLink = "Dataset source URL is required";
    } else if (!isValidUrl(formData.additionalInfo.sourceLink)) {
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

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setCurrentStep(2);
  };

  const handlePublish = async () => {
    if (!validateForm()) return;
    if (datasetIdForEdit) {
      showToast(
        "Dataset update is not supported. Metadata changes cannot be saved.",
        "error",
      );
      return;
    }

    const stagedFiles = formData.files.filter(
      (f) => f.status === "success" && f.stagedPath,
    );
    if (stagedFiles.length === 0) {
      setErrors((prev) => ({
        ...prev,
        files: "At least one file must be uploaded successfully",
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (!api.hasToken) {
        throw new Error(ApiErrorMessage.NO_ACCESS_TOKEN);
      }

      const totalSize = stagedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
      const mimeType = stagedFiles[0]?.type || "application/octet-stream";
      const code = slugify(formData.basicInfo.title) || `dataset-${Date.now()}`;

      const dataLocations = stagedFiles
        .filter((f) => Boolean(f.stagedPath?.trim()))
        .map((f) => ({
          kind: DATA_LOCATION_KIND_FILE,
          location: f.stagedPath as string,
        }));

      if (dataLocations.length === 0) {
        setErrors((prev) => ({
          ...prev,
          files: "At least one file must be uploaded successfully",
        }));
        setIsSubmitting(false);
        return;
      }

      const datasetId = await api.onboardDataset({
        code,
        name: formData.basicInfo.title,
        description: formData.basicInfo.description.trim(),
        license: formData.classification.license.trim(),
        mimeType,
        size: totalSize,
        url: formData.additionalInfo.sourceLink.trim(),
        version: "",
        headline: formData.basicInfo.headline,
        keywords: formData.basicInfo.keywords,
        fieldOfScience: formData.classification.fieldsOfScience,
        language: [],
        country: [],
        datePublished: new Date().toISOString().split("T")[0],
        citeAs: formData.additionalInfo.referenceString.trim(),
        conformsTo: "https://schema.org/Dataset",
        dataLocations,
      });

      if (!datasetId || typeof datasetId !== "string" || !datasetId.trim()) {
        throw new Error(ApiErrorMessage.ONBOARD_DATASET_FAILED);
      }

      if (accessType === "restricted" && groupPermissions.length > 0) {
        for (const row of groupPermissions) {
          const rolesToAssign = (
            Object.keys(row.permissions) as PermissionKey[]
          ).filter((key) => row.permissions[key]);
          for (const key of rolesToAssign) {
            const role = DATASET_ROLE_MAP[key];
            if (role) {
              await api.assignGroupDatasetGrant(row.id, datasetId, role);
            }
          }
        }
      }

      await profileAndResolveDatasetId(datasetId, formData.basicInfo.title);

      setFormData(initialFormData);
      setErrors(initialErrors);
      setCurrentStep(1);
      setAccessType("public");
      setGroupPermissions([]);
      setShowSuccessModal(true);
    } catch (error) {
      logError("Error submitting dataset", error);
      showToast(
        error instanceof Error ? error.message : "Failed to onboard dataset.",
        "error",
      );
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
    classification: FormData["classification"],
  ) => {
    setFormData((prev) => ({ ...prev, classification }));
  };

  const handleAdditionalInfoChange = (
    additionalInfo: FormData["additionalInfo"],
  ) => {
    setFormData((prev) => ({ ...prev, additionalInfo }));
  };

  if (currentStep === 2) {
    return (
      <>
        <AddDatasetShareStep
          accessType={accessType}
          onAccessTypeChange={setAccessType}
          groupPermissions={groupPermissions}
          onGroupPermissionsChange={setGroupPermissions}
          onPublish={handlePublish}
          onCancel={() => setCurrentStep(1)}
          isPublishing={isSubmitting}
        />
        <Toast
          message={toast.message}
          isVisible={toast.visible}
          onClose={() => setToast((t) => ({ ...t, visible: false }))}
          type={toast.type}
        />
        <SuccessModal
          isVisible={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            router.push(getNavigationUrl(APP_ROUTES.BROWSE));
          }}
          title="Upload successful"
          message="Your dataset has been published successfully."
          buttonText="OK"
        />
      </>
    );
  }

  return (
    <form onSubmit={handleNext} noValidate>
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
                onUpload={api.uploadDatasetFiles}
                allowedExtensions={allowedExtensions}
                onRemoteUploadNotSupported={(msg) => showToast(msg, "error")}
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

      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 sm:gap-3">
        <Button
          type="submit"
          className="w-full sm:w-auto px-6 sm:px-8 order-1 sm:order-1"
        >
          Next
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
          className="w-full sm:w-auto order-2 sm:order-2"
        >
          Cancel
        </Button>
      </div>
      <Toast
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
        type={toast.type}
      />
      <SuccessModal
        isVisible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.push(getNavigationUrl(APP_ROUTES.BROWSE));
        }}
        title="Upload successful"
        message="Your dataset has been published successfully."
        buttonText="OK"
      />
    </form>
  );
}
