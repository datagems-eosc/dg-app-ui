"use client";

import DashboardLayout from "@/components/DashboardLayout";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import { Dataset } from "@/data/mockDatasets";
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { convertToBackendFilters, FilterState } from "@/config/filterOptions";
import { getNavigationUrl } from "@/lib/utils";
import { useCollections } from "@/contexts/CollectionsContext";
import { apiClient } from "@/lib/apiClient";

const API_PAYLOAD = {
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
      "fieldsOfScience",
      "size",
      "datePublished",
      "collections.id",
      "collections.code",
      "collections.name",
      "collections.datasetCount",
      "permissions.browseDataset",
      "permissions.editDataset",
    ],
  },
  page: {
    Offset: 0,
    Size: 100,
  },
  Order: {
    Items: ["+code"],
  },
  Metadata: {
    CountAll: true,
  },
};

type Collection = { id: string; name: string; code: string };
function mapApiDatasetToDataset(api: unknown): Dataset & {
  collections?: Collection[];
  license?: string;
  mimeType?: string;
  fieldsOfScience?: string[];
  size?: string;
  datePublished?: string;
} {
  if (typeof api !== "object" || api === null) {
    return {
      id: "",
      title: "Untitled",
      category: "Math",
      access: "Restricted",
      description: "",
      size: "N/A",
      lastUpdated: "2024-01-01",
      tags: [], // Provide empty array for tags
      collections: [],
      license: undefined,
      mimeType: undefined,
      fieldsOfScience: undefined,
      datePublished: undefined,
    };
  }
  const obj = api as Record<string, unknown>;
  const collections: Collection[] = Array.isArray(obj.collections)
    ? obj.collections
        .map((c) =>
          typeof c === "object" && c !== null && "name" in c && "id" in c
            ? {
                id: String((c as Record<string, unknown>).id ?? ""),
                name: String((c as Record<string, unknown>).name),
                code: String((c as Record<string, unknown>).code ?? ""),
              }
            : undefined
        )
        .filter(
          (c): c is Collection =>
            !!c && typeof c.id === "string" && typeof c.name === "string"
        )
    : [];

  // Handle fieldsOfScience - could be string or array
  let fieldsOfScience: string[] | undefined;
  if (obj.fieldsOfScience) {
    if (Array.isArray(obj.fieldsOfScience)) {
      fieldsOfScience = obj.fieldsOfScience.map(String);
    } else if (typeof obj.fieldsOfScience === "string") {
      fieldsOfScience = [obj.fieldsOfScience];
    }
  }

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: "Math", // fallback only
    access:
      Array.isArray(obj.permissions) &&
      obj.permissions.includes("browsedataset")
        ? "Open Access"
        : "Restricted",
    description: String(obj.description ?? ""),
    size: obj.size ? String(obj.size) : "N/A",
    lastUpdated: obj.datePublished ? String(obj.datePublished) : "2024-01-01",
    tags: [], // Provide empty array for tags
    collections,
    license: obj.license ? String(obj.license) : undefined,
    mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
    fieldsOfScience,
    datePublished: obj.datePublished ? String(obj.datePublished) : undefined,
  };
}

// next-auth session type does not include accessToken by default
export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);
  const { data: session } = useSession() as any;
  const [filteredDatasets, setFilteredDatasets] = useState<Dataset[]>([]);
  const [searchTerm, setSearchTerm] = useState(""); // used for API
  const [pendingSearchTerm, setPendingSearchTerm] = useState(""); // input value
  const [sortBy, setSortBy] = useState("name-asc");
  const selectedCollection = searchParams.get("collection");
  const [filters, setFilters] = useState<FilterState>({
    access: "",
    creationYear: { start: "", end: "" },
    datasetSize: { start: "", end: "" },
    fieldsOfScience: [],
    license: [],
  });
  // Collections & actions (parity with /browse)
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const { addCollection } = useCollections();

  /**
   * Fetch datasets from API. If searchTerm is at least 3 chars, add 'like' to payload.
   * Use sortBy to set the order.items field in the payload.
   * Show loader while fetching. If searchTerm is less than 3 chars, load all datasets.
   */
  useEffect(() => {
    const fetchDatasets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = session?.accessToken;
        if (!token) {
          setError("No authentication token found. Please log in again.");
          setIsLoading(false);
          return;
        }
        let payload: any = { ...API_PAYLOAD };

        // Set order.items based on sortBy
        let orderField = "name";
        let orderDir = "+";
        if (sortBy.startsWith("name")) orderField = "name";
        else if (sortBy.startsWith("size")) orderField = "size";
        else if (sortBy.startsWith("datePublished"))
          orderField = "datePublished";
        if (sortBy.endsWith("desc")) orderDir = "-";
        payload.Order = { Items: [orderDir + orderField] };

        // Add search term if >= 3 characters
        if (searchTerm.length >= 3) {
          payload = {
            ...payload,
            like: `%${searchTerm}%`,
          };
        }

        // Convert frontend filters to backend format
        const backendFilters = convertToBackendFilters(filters);

        // Add backend filters to payload
        if (backendFilters.license && backendFilters.license.length > 0) {
          payload.license = backendFilters.license.join(",");
        }
        if (
          backendFilters.fieldsOfScience &&
          backendFilters.fieldsOfScience.length > 0
        ) {
          payload.fieldsOfScience = backendFilters.fieldsOfScience;
        }
        if (
          backendFilters.publishedRange &&
          (backendFilters.publishedRange.start ||
            backendFilters.publishedRange.end)
        ) {
          payload.publishedRange = backendFilters.publishedRange;
        }
        if (backendFilters.sizeRange) {
          // Only include properties that are defined and greater than 0
          const sizeRange: any = {};
          if (
            backendFilters.sizeRange.start !== undefined &&
            backendFilters.sizeRange.start > 0
          ) {
            sizeRange.start = backendFilters.sizeRange.start;
          }
          if (
            backendFilters.sizeRange.end !== undefined &&
            backendFilters.sizeRange.end > 0
          ) {
            sizeRange.end = backendFilters.sizeRange.end;
          }

          // Only add sizeRange to payload if it has at least one property
          if (Object.keys(sizeRange).length > 0) {
            payload.sizeRange = sizeRange;
          }
        }

        const data = await apiClient.queryDatasets(payload, token);
        const items = Array.isArray(data.items) ? data.items : [];
        const mappedDatasets = items.map(mapApiDatasetToDataset);
        setAllDatasets(mappedDatasets);
      } catch (err: unknown) {
        let message = "An unexpected error occurred";
        if (err instanceof Error) message = err.message;
        else if (typeof err === "string") message = err;
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDatasets();
  }, [router, session, searchTerm, sortBy, filters]);

  // Filter datasets when selectedCollection changes (frontend filtering for collection)
  useEffect(() => {
    if (selectedCollection && allDatasets.length > 0) {
      const filtered = allDatasets.filter(
        (
          dataset: Dataset & {
            collections?: { id: string; name: string; code: string }[];
          }
        ) => {
          return dataset.collections?.some(
            (col) => col.id === selectedCollection
          );
        }
      );
      setFilteredDatasets(filtered);
    } else {
      setFilteredDatasets(allDatasets);
    }
  }, [selectedCollection, allDatasets]);

  const handleSearchTermChange = useCallback((value: string) => {
    setPendingSearchTerm(value);
  }, []);

  const handleSearchTermSubmit = useCallback(() => {
    setSearchTerm(pendingSearchTerm.trim());
  }, [pendingSearchTerm]);

  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Mount flag for safe localStorage access
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // On non-chat pages, ensure chat selection is cleared in localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [isMounted]);

  // Selected panel controls
  const handleCloseSidebar = useCallback(() => {
    setShowSelectedPanel(false);
  }, []);

  const handleReopenSidebar = useCallback(() => {
    setShowSelectedPanel(true);
  }, []);

  // Chat navigation with selected datasets
  const handleChatWithData = useCallback(() => {
    if (isMounted) {
      localStorage.setItem(
        "chatSelectedDatasets",
        JSON.stringify(selectedDatasets)
      );
    }
    router.push(getNavigationUrl("/chat"));
  }, [router, isMounted, selectedDatasets]);

  // Create collection from selected datasets
  const handleAddToCollection = useCallback(() => {
    if (selectedDatasets.length === 0) {
      alert("Please select some datasets first");
      return;
    }
    setShowCreateCollectionModal(true);
  }, [selectedDatasets]);

  const handleCreateCollection = useCallback(
    (name: string) => {
      addCollection(name, selectedDatasets);
      alert(
        `Collection "${name}" created successfully with ${selectedDatasets.length} datasets!`
      );
    },
    [addCollection, selectedDatasets]
  );

  return (
    <DashboardLayout>
      <div className="relative">
        <Browse
          datasets={filteredDatasets}
          title={selectedCollection ? `Browse Datasets` : "Browse All Datasets"}
          subtitle={
            selectedCollection
              ? `Filtered by collection`
              : "List of all datasets"
          }
          showSelectAll={true}
          showAddButton={true}
          searchTerm={pendingSearchTerm}
          onSearchTermChange={handleSearchTermChange}
          onSearchTermSubmit={handleSearchTermSubmit}
          isLoading={isLoading}
          error={error}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={handleChatWithData}
          onAddToCollection={handleAddToCollection}
        />

        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          onCreateCollection={handleCreateCollection}
          selectedDatasets={selectedDatasets}
          datasets={allDatasets}
        />
      </div>
    </DashboardLayout>
  );
}
