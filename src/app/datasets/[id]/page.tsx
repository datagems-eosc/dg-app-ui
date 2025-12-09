"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DatasetDetailsPageContent from "@/components/DatasetDetailsPage/DatasetDetailsPageContent";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logApiError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";

export default function DatasetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const api = useApi();
  const [dataset, setDataset] = useState<DatasetPlus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const datasetId = useMemo(() => {
    if (!params?.id || typeof params.id !== "string") {
      return null;
    }
    return params.id;
  }, [params]);

  useEffect(() => {
    if (!datasetId) {
      setIsLoading(false);
      setError("Dataset ID is required");
      return;
    }

    if (!api.hasToken) {
      setIsLoading(false);
      setError("Authentication required");
      return;
    }

    let isCancelled = false;

    const fetchDataset = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = {
          project: {
            fields: [
              "id",
              "code",
              "name",
              "description",
              "license",
              "mimeType",
              "url",
              "version",
              "fieldOfScience",
              "keywords",
              "size",
              "datePublished",
              "lastUpdated",
              "collections.id",
              "collections.code",
              "collections.name",
              "collections.datasetCount",
              "permissions.browseDataset",
              "permissions.editDataset",
              "permissions.downloadDataset",
              "permissions.manageDataset",
              "specification.totalRecords",
              "specification.timeRange",
              "specification.geographicCoverage",
              "specification.populationDensity",
              "specification.climateZones",
              "specification.keyBiodiversityAreas",
              "useCases",
              "language",
              "country",
              "citation",
            ],
          },
          ids: [datasetId],
          page: {
            Offset: 0,
            Size: 1,
          },
          Order: {
            Items: ["+code"],
          },
          Metadata: {
            CountAll: true,
          },
        };

        const response = await api.queryDatasets(payload);

        if (isCancelled) return;

        const items = Array.isArray(response.items) ? response.items : [];

        if (items.length === 0) {
          setError("Dataset not found");
          setIsLoading(false);
          return;
        }

        const apiDataset = items[0];
        const mappedDataset = mapApiDatasetToDatasetPlus(apiDataset);
        setDataset(mappedDataset);
        setIsLoading(false);
      } catch (err) {
        if (isCancelled) return;
        logApiError("fetchDataset", err, { datasetId });
        setError("Failed to load dataset");
        setIsLoading(false);
      }
    };

    fetchDataset();

    return () => {
      isCancelled = true;
    };
  }, [datasetId, api.hasToken]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dataset...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !dataset) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96 p-6">
          <div className="text-center">
            <h1 className="text-H2-24-semibold text-gray-900 mb-2">
              {error || "Dataset Not Found"}
            </h1>
            <p className="text-gray-600 mb-4">
              {error ||
                "The dataset you're looking for doesn't exist or has been removed."}
            </p>
            <button
              onClick={() => router.push(getNavigationUrl("/browse"))}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Go to Browse
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DatasetDetailsPageContent dataset={dataset} />
    </DashboardLayout>
  );
}

function mapApiDatasetToDatasetPlus(api: unknown): DatasetPlus {
  if (typeof api !== "object" || api === null) {
    throw new Error("Invalid dataset data");
  }

  const obj = api as Record<string, unknown>;
  const collections = Array.isArray(obj.collections)
    ? obj.collections
        .map((c) => {
          if (typeof c === "object" && c !== null && "name" in c && "id" in c) {
            return {
              id: String((c as Record<string, unknown>).id ?? ""),
              name: String((c as Record<string, unknown>).name),
              code: String((c as Record<string, unknown>).code ?? ""),
            };
          }
          return undefined;
        })
        .filter(
          (c): c is { id: string; name: string; code: string } =>
            !!c && typeof c.id === "string" && typeof c.name === "string",
        )
    : [];

  let fieldOfScience: string[] | undefined;
  if (obj.fieldOfScience) {
    if (Array.isArray(obj.fieldOfScience)) {
      fieldOfScience = obj.fieldOfScience.map(String);
    } else if (typeof obj.fieldOfScience === "string") {
      fieldOfScience = [obj.fieldOfScience];
    }
  }

  let keywords: string[] | undefined;
  if (obj.keywords) {
    if (Array.isArray(obj.keywords)) {
      keywords = obj.keywords.map(String);
    } else if (typeof obj.keywords === "string") {
      keywords = [obj.keywords];
    }
  }

  const permissions = obj.permissions;
  let permissionArray: string[] = [];
  if (typeof permissions === "object" && permissions !== null) {
    const permObj = permissions as Record<string, unknown>;
    if (permObj.browseDataset) permissionArray.push("Browse");
    if (permObj.editDataset) permissionArray.push("Edit");
    if (permObj.downloadDataset) permissionArray.push("Download");
    if (permObj.manageDataset) permissionArray.push("Manage");
  } else if (Array.isArray(permissions)) {
    permissionArray = permissions.map(String);
  }

  const specification = obj.specification;
  let specData:
    | {
        totalRecords?: string;
        timeRange?: string;
        geographicCoverage?: string;
        populationDensity?: string;
        climateZones?: string;
        keyBiodiversityAreas?: string;
      }
    | undefined;
  if (typeof specification === "object" && specification !== null) {
    const spec = specification as Record<string, unknown>;
    specData = {
      totalRecords: spec.totalRecords ? String(spec.totalRecords) : undefined,
      timeRange: spec.timeRange ? String(spec.timeRange) : undefined,
      geographicCoverage: spec.geographicCoverage
        ? String(spec.geographicCoverage)
        : undefined,
      populationDensity: spec.populationDensity
        ? String(spec.populationDensity)
        : undefined,
      climateZones: spec.climateZones ? String(spec.climateZones) : undefined,
      keyBiodiversityAreas: spec.keyBiodiversityAreas
        ? String(spec.keyBiodiversityAreas)
        : undefined,
    };
  }

  let useCases: string | undefined;
  if (obj.useCases) {
    useCases = String(obj.useCases);
  }

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: collections.length > 0 ? "Weather" : "Math",
    access:
      Array.isArray(obj.permissions) &&
      obj.permissions.includes("browsedataset")
        ? "Open Access"
        : permissionArray.includes("Browse")
          ? "Open Access"
          : "Restricted",
    description: String(obj.description ?? ""),
    size: obj.size ? String(obj.size) : "N/A",
    lastUpdated: obj.lastUpdated
      ? String(obj.lastUpdated)
      : obj.datePublished
        ? String(obj.datePublished)
        : "2024-01-01",
    tags: [],
    collections,
    license: obj.license ? String(obj.license) : undefined,
    mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
    fieldOfScience,
    datePublished: obj.datePublished ? String(obj.datePublished) : undefined,
    keywords,
    url: obj.url ? String(obj.url) : undefined,
    version: obj.version ? String(obj.version) : undefined,
    permissions: permissionArray,
    specification: specData,
    useCases,
    language: obj.language ? String(obj.language) : undefined,
    country: obj.country ? String(obj.country) : undefined,
    citation: obj.citation ? String(obj.citation) : undefined,
  };
}
