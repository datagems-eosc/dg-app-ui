"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Collection, Dataset, DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";

const DATASET_FIELDS = {
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
      "collections.id",
      "collections.code",
      "collections.name",
      "collections.datasetCount",
      "permissions.browseDataset",
      "permissions.editDataset",
    ],
  },
  page: { Offset: 0, Size: 100 },
  Order: { Items: ["+code"] },
  Metadata: { CountAll: true },
};

type DatasetWithCollections = Dataset & { collections?: Collection[] };

function extractCollections(raw: unknown[]): Collection[] {
  return raw
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null,
    )
    .map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      code: String(c.code ?? ""),
    }))
    .filter((c) => c.id);
}

function mapApiDataset(obj: Record<string, unknown>): DatasetWithCollections {
  const collections = extractCollections(
    Array.isArray(obj.collections) ? obj.collections : [],
  );
  const access =
    Array.isArray(obj.permissions) && obj.permissions.includes("browsedataset")
      ? ("Open Access" as const)
      : ("Restricted" as const);

  return {
    id: String(obj.id ?? ""),
    title: String(obj.name ?? obj.code ?? "Untitled"),
    category: "Math",
    access,
    description: String(obj.description ?? ""),
    size: obj.size ? String(obj.size) : "N/A",
    lastUpdated: obj.datePublished ? String(obj.datePublished) : "2024-01-01",
    tags: Array.isArray(obj.keywords) ? obj.keywords.map(String) : [],
    collections,
    keywords: Array.isArray(obj.keywords)
      ? obj.keywords.map(String)
      : undefined,
    license: obj.license ? String(obj.license) : undefined,
    mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
    url: obj.url ? String(obj.url) : undefined,
  };
}

interface UseCasePageClientProps {
  collectionName: string;
  title: string;
  subtitle: string;
  withLayout?: boolean;
}

export default function UseCasePageClient({
  collectionName,
  title,
  subtitle,
  withLayout = true,
}: UseCasePageClientProps) {
  const api = useApi();
  const router = useRouter();
  const { collections } = useCollections();

  // allDatasets: full collection datasets (normal mode) or smart search results
  const [allDatasets, setAllDatasets] = useState<DatasetPlus[]>([]);
  const [pendingSearchTerm, setPendingSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem("chatSelectedDatasets");
  }, []);

  useEffect(() => {
    if (!api.hasToken) return;

    const normalized = collectionName.toLowerCase().trim();

    const fetchDatasets = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Smart search path — mirrors BrowseClient exactly.
        // Results are NOT filtered by collection (same as BrowseClient: smart search
        // is cross-collection by design; the page title provides the context).
        if (isSmartSearchEnabled && searchTerm.trim().length >= 3) {
          const persistData = await api.persistConversation(
            { name: searchTerm },
            "?f=id&f=etag",
          );
          const conversationId = persistData.id;
          if (!conversationId) throw new Error("No conversation ID returned.");

          const data = await api.searchCrossDataset({
            conversationOptions: {
              conversationId,
              autoCreateConversation: false,
            },
            project: {
              fields: [
                "conversationId",
                "content",
                "useCase",
                "dataset.id",
                "dataset.code",
                "dataset.name",
                "dataset.description",
                "dataset.license",
                "dataset.mimeType",
                "dataset.url",
                "dataset.version",
                "dataset.fieldOfScience",
                "dataset.keywords",
                "dataset.size",
                "dataset.datePublished",
                "dataset.collections.id",
                "dataset.collections.code",
                "dataset.collections.name",
                "dataset.collections.datasetCount",
                "dataset.permissions.browseDataset",
                "dataset.permissions.editDataset",
                "dataset.profileRaw",
                "hits.content",
                "hits.objectId",
                "hits.similarity",
                "sourceId",
                "chunkId",
                "language",
                "distance",
                "maxSimilarity",
              ],
            },
            query: searchTerm,
            resultCount: 100,
          } as any);

          const results = Array.isArray(data.result) ? data.result : [];
          const byId = new Map<string, DatasetPlus>();

          for (const item of results) {
            const ds = (item as any)?.dataset || {};
            if (!ds || typeof ds !== "object") continue;
            const id = String(ds.id ?? "");
            if (!id || byId.has(id)) continue;

            const maxSimilarity =
              typeof (item as any).maxSimilarity === "number"
                ? (item as any).maxSimilarity
                : undefined;

            const rawHits = Array.isArray((item as any).hits)
              ? (item as any).hits
              : [];
            const hits = rawHits.slice(0, 3).map((h: any, idx: number) => ({
              number:
                h && typeof h === "object" && typeof h.number === "number"
                  ? h.number
                  : idx,
              text:
                h && typeof h === "object" && ("content" in h || "text" in h)
                  ? String(h.content ?? h.text ?? "")
                  : String(h ?? ""),
              similarity:
                h && typeof h === "object" && typeof h.similarity === "number"
                  ? h.similarity
                  : h &&
                      typeof h === "object" &&
                      typeof h.maxSimilarity === "number"
                    ? h.maxSimilarity
                    : 0,
            }));

            const collections = extractCollections(
              Array.isArray(ds.collections) ? ds.collections : [],
            );
            const permissions = Array.isArray(ds.permissions)
              ? ds.permissions
              : [];
            const access = permissions.includes("browsedataset")
              ? ("Open Access" as const)
              : ("Restricted" as const);

            byId.set(id, {
              id,
              title: String(ds.name ?? ds.code ?? "Untitled"),
              category: "Math",
              access,
              maxSimilarity,
              hits,
              description: String(ds.description ?? ""),
              size: ds.size ? String(ds.size) : "N/A",
              lastUpdated: ds.datePublished
                ? String(ds.datePublished)
                : "2024-01-01",
              tags: Array.isArray(ds.keywords)
                ? ds.keywords.map((k: any) => String(k))
                : [],
              collections,
              license: ds.license ? String(ds.license) : undefined,
              mimeType: ds.mimeType ? String(ds.mimeType) : undefined,
              fieldOfScience: Array.isArray(ds.fieldOfScience)
                ? ds.fieldOfScience.map((f: any) => String(f))
                : undefined,
              datePublished: ds.datePublished
                ? String(ds.datePublished)
                : undefined,
              keywords: Array.isArray(ds.keywords)
                ? ds.keywords.map((k: any) => String(k))
                : undefined,
              url: ds.url ? String(ds.url) : undefined,
              version: ds.version ? String(ds.version) : undefined,
            });
          }

          setAllDatasets(Array.from(byId.values()));
          setIsLoading(false);
          return;
        }

        // Normal fetch — server-side collection filtering via collectionIds when available
        const collectionId = collections.find(
          (c) => c.name?.toLowerCase().trim() === normalized,
        )?.id;

        const payload = collectionId
          ? { ...DATASET_FIELDS, collectionIds: [collectionId] }
          : DATASET_FIELDS;

        const data = await api.queryDatasets(payload);
        const items: unknown[] = Array.isArray(data.items) ? data.items : [];
        const mapped = items
          .filter(
            (d): d is Record<string, unknown> =>
              typeof d === "object" && d !== null,
          )
          .map(mapApiDataset)
          .filter((d) =>
            collectionId
              ? true
              : d.collections?.some(
                  (c) => c.name.toLowerCase().trim() === normalized,
                ),
          );
        setAllDatasets(mapped as DatasetPlus[]);
      } catch (err) {
        logError("fetchDatasets failed", err);
        setError(
          err instanceof Error ? err.message : "Failed to load datasets",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDatasets();
  }, [
    api.hasToken,
    searchTerm,
    isSmartSearchEnabled,
    collectionName,
    collections,
  ]);

  // Client-side text filter for normal search mode only.
  // Smart search results are shown as-is (already ranked by relevance).
  const displayedDatasets = useMemo(() => {
    if (isSmartSearchEnabled) return allDatasets;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allDatasets;
    return allDatasets.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        (d.description ?? "").toLowerCase().includes(term) ||
        d.keywords?.some((k) => k.toLowerCase().includes(term)),
    );
  }, [allDatasets, searchTerm, isSmartSearchEnabled]);

  // Mirrors BrowseClient exactly: submit only sets searchTerm, useEffect does the work.
  const handleSearchTermChange = useCallback((value: string) => {
    setPendingSearchTerm(value);
  }, []);

  const handleSearchTermSubmit = useCallback(
    (value?: string) => {
      setSearchTerm(value !== undefined ? value : pendingSearchTerm.trim());
    },
    [pendingSearchTerm],
  );

  const handleChatWithData = useCallback(() => {
    localStorage.setItem(
      "chatSelectedDatasets",
      JSON.stringify(selectedDatasets),
    );
    router.push(getNavigationUrl("/chat"));
  }, [router, selectedDatasets]);

  const handleAddToCollection = useCallback(() => {
    if (selectedDatasets.length === 0) {
      alert("Please select some datasets first");
      return;
    }
    setShowCreateCollectionModal(true);
  }, [selectedDatasets]);

  const content = (
    <div className="relative p-6">
      <Browse
        datasets={displayedDatasets}
        title={title}
        subtitle={subtitle}
        showSelectAll={true}
        showSearchAndFilters={true}
        searchTerm={pendingSearchTerm}
        onSearchTermChange={handleSearchTermChange}
        onSearchTermSubmit={handleSearchTermSubmit}
        isSmartSearchEnabled={isSmartSearchEnabled}
        onSmartSearchToggle={setIsSmartSearchEnabled}
        selectedDatasets={selectedDatasets}
        onSelectedDatasetsChange={setSelectedDatasets}
        showSelectedPanel={showSelectedPanel}
        onCloseSidebar={() => setShowSelectedPanel(false)}
        onReopenSidebar={() => setShowSelectedPanel(true)}
        onChatWithData={handleChatWithData}
        onAddToCollection={handleAddToCollection}
        isLoading={isLoading}
        error={error}
      />

      <CreateCollectionModal
        isVisible={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
        selectedDatasets={selectedDatasets}
        datasets={allDatasets}
      />
    </div>
  );

  if (!withLayout) return content;

  return <DashboardLayout>{content}</DashboardLayout>;
}
