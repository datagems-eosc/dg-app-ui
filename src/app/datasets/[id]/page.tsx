"use client";

import { Button } from "@ui/Button";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DatasetDetailsPageContent from "@/components/DatasetDetailsPage/DatasetDetailsPageContent";
import { APP_ROUTES } from "@/config/appUrls";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { decodeCallerPermissions } from "@/lib/datasetPermissions/decode";
import {
  datasetPermissionEvidence,
  decideAction,
  PERMISSIONS_FAILED,
  permissionLabelsForDisplay,
  SHARING_WITHOUT_EVIDENCE,
} from "@/lib/datasetPermissions/model";
import { ACCESS_ACTION_NAMES } from "@/lib/datasetPermissions/types";
import { fieldOfScienceLabels } from "@/lib/fieldsOfScience";
import { logApiError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import { processFieldsOfScience } from "@/lib/vocabularyService";

const DATASET_ERROR_MESSAGES = {
  "not-found": "Dataset not found.",
  "no-access": "You don't have access to this dataset.",
  "request-failed": "We couldn't load this dataset.",
  "missing-id": "Dataset ID is required",
  "authentication-required": "Authentication required",
};
const MANAGEMENT_PERMISSIONS = [
  ACCESS_ACTION_NAMES.grant,
  ACCESS_ACTION_NAMES.revoke,
];

type DatasetErrorKind = keyof typeof DATASET_ERROR_MESSAGES;

type DatasetReadState =
  | { owner: string | null; status: "loading" }
  | { owner: string; status: "success"; dataset: DatasetPlus }
  | { owner: string; status: "error"; kind: DatasetErrorKind };

export default function DatasetDetailsPage() {
  const [attempt, setAttempt] = useState(0);
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const principalId = api.datasetPermissions.scope?.principalId ?? null;
  const { readGlobalPermissions } = api.datasetPermissions.gateway;
  const [read, setRead] = useState<DatasetReadState>({
    owner: null,
    status: "loading",
  });

  const datasetId = useMemo(() => {
    if (!params?.id || typeof params.id !== "string") {
      return null;
    }
    return params.id;
  }, [params]);

  const owner =
    datasetId && principalId ? JSON.stringify([datasetId, principalId]) : null;

  useEffect(() => {
    if (!datasetId || !api.hasToken || !principalId || !owner) {
      setRead({ owner: null, status: "loading" });
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchDataset = async () => {
      setRead({ owner, status: "loading" });

      try {
        const [apiDataset, global, fieldsOfScience] = await Promise.all([
          api.getDatasetById(datasetId, [
            "id",
            "code",
            "name",
            "headline",
            "description",
            "license",
            "url",
            "version",
            "fieldOfScience",
            "keywords",
            "datePublished",
            "collections.id",
            "collections.code",
            "collections.name",
            "permissions.browseDataset",
            "permissions.searchDataset",
            "permissions.editDataset",
            "permissions.downloadDatasetFile",
            ...MANAGEMENT_PERMISSIONS.map(
              (name) => `permissions.${name[0].toLowerCase()}${name.slice(1)}`,
            ),
            "language",
            "country",
            "citeAs",
            "profileRaw",
          ]),
          readGlobalPermissions(controller.signal).catch(() => ({
            evidence: PERMISSIONS_FAILED,
          })),
          // Without the vocabulary, fields of science are shown as stored.
          api
            .getFieldsOfScience()
            .then(processFieldsOfScience)
            .catch(() => []),
        ]);

        if (isCancelled) return;

        if (!apiDataset || typeof apiDataset !== "object") {
          setRead({ owner, status: "error", kind: "not-found" });
          return;
        }
        const evidence = {
          global: global.evidence,
          datasetContext: datasetPermissionEvidence(
            decodeCallerPermissions(apiDataset.permissions),
            MANAGEMENT_PERMISSIONS,
          ),
        };
        const mayManage =
          decideAction("grant", evidence) === "allowed" ||
          decideAction("revoke", evidence) === "allowed";
        const mappedDataset = mapApiDatasetToDatasetPlus(apiDataset);
        if (mappedDataset.fieldOfScience) {
          mappedDataset.fieldOfScience = fieldOfScienceLabels(
            mappedDataset.fieldOfScience,
            fieldsOfScience,
          );
        }
        mappedDataset.permissions = mappedDataset.permissions?.filter(
          (name) => name !== "Manage",
        );
        if (mayManage)
          mappedDataset.permissions = [
            ...(mappedDataset.permissions ?? []),
            "Manage",
          ];
        if (isCancelled) return;
        setRead({ owner, status: "success", dataset: mappedDataset });
      } catch (err) {
        if (isCancelled) return;
        logApiError("fetchDataset", err, { datasetId });
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? err.status
            : undefined;
        setRead({
          owner,
          status: "error",
          kind:
            status === 404
              ? "not-found"
              : status === 403
                ? "no-access"
                : "request-failed",
        });
      }
    };

    fetchDataset();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [
    attempt,
    datasetId,
    principalId,
    owner,
    api.hasToken,
    api.getDatasetById,
    api.getFieldsOfScience,
    readGlobalPermissions,
  ]);

  const errorKind: DatasetErrorKind | null = !datasetId
    ? "missing-id"
    : !api.hasToken || !principalId
      ? "authentication-required"
      : read.owner === owner && read.status === "error"
        ? read.kind
        : null;
  const error = errorKind ? DATASET_ERROR_MESSAGES[errorKind] : null;
  const dataset =
    read.owner === owner && read.status === "success" ? read.dataset : null;
  const isLoading =
    !error && (read.owner !== owner || read.status === "loading");

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
            {errorKind === "request-failed" && (
              <Button onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
            )}
            <Button
              onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
            >
              Go to Browse
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const returnTo = searchParams.get("returnTo");

  return (
    <DashboardLayout>
      <DatasetDetailsPageContent
        key={owner}
        dataset={dataset}
        returnToRoles={returnTo === "settings-roles"}
      />
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

  // Arrays are objects, so the previous `typeof permissions === "object"`
  // check made the array branch unreachable and a real Gateway response
  // decoded to no permissions at all. The decoder handles the array shape
  // first and keeps the legacy object shape as compatibility input. An
  // undefined result means "no readable evidence" and stays undefined: it is
  // not the same as an empty list, and neither becomes an invented role.
  const permissionLabels = permissionLabelsForDisplay(
    decodeCallerPermissions(obj.permissions),
  );

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: collections.length > 0 ? "Weather" : "Math",
    // Publication is deliberately absent rather than guessed. This page reads
    // no group semantics and no dataset grants, and the caller's own Browse
    // permission says nothing about whether the Everyone audience has any.
    sharing: SHARING_WITHOUT_EVIDENCE.state,
    headline: typeof obj.headline === "string" ? obj.headline : undefined,
    description: String(obj.description ?? ""),
    size: "",
    lastUpdated: "",
    tags: [],
    collections,
    license: obj.license ? String(obj.license) : undefined,
    fieldOfScience,
    datePublished:
      typeof obj.datePublished === "string" ? obj.datePublished : undefined,
    keywords,
    url: obj.url ? String(obj.url) : undefined,
    version: obj.version ? String(obj.version) : undefined,
    permissions: permissionLabels,
    language: obj.language ? String(obj.language) : undefined,
    country: obj.country ? String(obj.country) : undefined,
    citation: obj.citeAs ? String(obj.citeAs) : undefined,
    profileRaw: obj.profileRaw ?? null,
  };
}
