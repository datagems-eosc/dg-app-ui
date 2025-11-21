"use client";

import { Trash } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { generateChatUrl } from "@/config/appUrls";
import { useCollections } from "@/contexts/CollectionsContext";
import { useApi } from "@/hooks/useApi";
import { createUrl } from "@/lib/utils";
import type { ApiCollection } from "@/types/collection";
import CollectionSettingsModal from "./CollectionSettingsModal";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { MainHeader } from "./ui/MainHeader";
import { SidebarContent } from "./ui/SidebarContent";
import { SidebarHeader } from "./ui/SidebarHeader";
import { Toast } from "./ui/Toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const hasLoadedCollections = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isCollectionSettingsOpen, setIsCollectionSettingsOpen] =
    useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isVisible: boolean;
    conversationId: string;
    conversationName: string;
  }>({
    isVisible: false,
    conversationId: "",
    conversationName: "",
  });
  const [conversations, setConversations] = useState<any[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const {
    apiCollections,
    extraCollections,
    isLoadingApiCollections,
    isLoadingExtraCollections,
    refreshAllCollections,
  } = useCollections();
  const { data: session } = useSession();

  // Extract conversation ID from pathname if we're on a chat page
  const currentConversationId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : undefined;

  // Refresh collections only once when component mounts and session is available
  useEffect(() => {
    if (session && !hasLoadedCollections.current) {
      hasLoadedCollections.current = true;
      refreshAllCollections();
    }
  }, [session, refreshAllCollections]);

  // Function to manually refresh collections when needed (e.g., after creating a collection)
  const _handleManualRefresh = () => {
    if (session) {
      refreshAllCollections();
    }
  };

  // Function to sort and filter collections based on localStorage settings
  const getSortedAndFilteredCollections = (
    collections: ApiCollection[],
    isExtra = false,
  ) => {
    const savedSettings =
      typeof window !== "undefined"
        ? window.localStorage.getItem("collectionSettings")
        : null;
    let settingsData: Record<string, { isVisible: boolean; order: number }> =
      {};

    if (savedSettings) {
      try {
        settingsData = JSON.parse(savedSettings);
      } catch (error) {
        console.error("Error parsing collection settings:", error);
      }
    }

    // Add settings data to collections
    const collectionsWithSettings = collections.map((collection, index) => {
      const settings = settingsData[collection.id];
      return {
        ...collection,
        isVisible: settings?.isVisible ?? true,
        order: settings?.order ?? index,
      };
    });

    // Filter visible collections and sort by order
    return collectionsWithSettings
      .filter((collection) => collection.isVisible)
      .sort((a, b) => a.order - b.order);
  };

  // Function to get collections with default ordering when localStorage is empty
  const getCollectionsWithDefaultOrder = () => {
    const savedSettings =
      typeof window !== "undefined"
        ? window.localStorage.getItem("collectionSettings")
        : null;

    if (!savedSettings) {
      // When localStorage is empty, return extraCollections first, then apiCollections
      const extraCollectionsWithDefaults = extraCollections.map(
        (collection, index) => ({
          ...collection,
          isVisible: true,
          order: index, // Start ordering from 0 for custom collections
        }),
      );

      const extraIds = new Set(extraCollectionsWithDefaults.map((c) => c.id));

      const apiCollectionsWithDefaults = apiCollections
        .filter((c) => !extraIds.has(c.id))
        .map((collection, index) => ({
          ...collection,
          isVisible: true,
          order: extraCollectionsWithDefaults.length + index, // Start ordering after custom collections
        }));

      return [...extraCollectionsWithDefaults, ...apiCollectionsWithDefaults];
    }

    // When localStorage has settings, use the existing logic but prioritize custom collections
    const customCollections = getSortedAndFilteredCollections(extraCollections);
    const customIds = new Set(customCollections.map((c) => c.id));

    const sortedApiCollections = getSortedAndFilteredCollections(
      apiCollections,
    ).filter((c) => !customIds.has(c.id));

    // Combine collections with custom collections first, then API collections
    return [...customCollections, ...sortedApiCollections];
  };

  // Handle mobile detection and sidebar state
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      const tablet = window.innerWidth >= 640 && window.innerWidth < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Listen for tablet-only requests from pages to close the sidebar when opening right panels
  useEffect(() => {
    const handleRequestCloseSidebarForTablet = () => {
      if (isTablet) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener(
      "requestCloseSidebarForTablet",
      handleRequestCloseSidebarForTablet,
    );
    return () => {
      window.removeEventListener(
        "requestCloseSidebarForTablet",
        handleRequestCloseSidebarForTablet,
      );
    };
  }, [isTablet]);

  // Listen for collection settings changes
  useEffect(() => {
    const handleCollectionSettingsChange = () => {
      // Force a re-render by using a dummy state update
      setIsCollectionSettingsOpen((prev) => prev);
    };

    const handleForceCollectionsRefresh = () => {
      // Force immediate refresh of collections
      refreshAllCollections();
    };

    window.addEventListener(
      "collectionSettingsChanged",
      handleCollectionSettingsChange,
    );
    window.addEventListener(
      "forceCollectionsRefresh",
      handleForceCollectionsRefresh,
    );

    return () => {
      window.removeEventListener(
        "collectionSettingsChanged",
        handleCollectionSettingsChange,
      );
      window.removeEventListener(
        "forceCollectionsRefresh",
        handleForceCollectionsRefresh,
      );
    };
  }, [refreshAllCollections]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const toggleSidebar = () => {
    const nextOpen = !isSidebarOpen;
    setIsSidebarOpen(nextOpen);
    // When opening the sidebar on tablets, notify pages to close their right panels
    if (nextOpen && isTablet) {
      window.dispatchEvent(new CustomEvent("sidebarOpenedForTablet"));
    }
  };

  const handleCollectionAskQuestion = (collectionId: string) => {
    const url = createUrl(generateChatUrl({ collection: collectionId }));
    router.push(url);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (
    conversationId: string,
    conversationName: string,
  ) => {
    setDeleteModalState({
      isVisible: true,
      conversationId,
      conversationName,
    });
  };

  const handleConfirmDeleteConversation = async () => {
    if (deleteModalState.conversationId && api.hasToken) {
      try {
        await api.deleteConversation(deleteModalState.conversationId);
        // Remove the conversation from local state immediately
        setConversations((prevConversations) =>
          prevConversations.filter(
            (conv) => conv.id !== deleteModalState.conversationId,
          ),
        );
        // Show success toast
        setToastType("success");
        setToastMessage("Conversation deleted successfully!");
        setShowToast(true);
      } catch (error) {
        console.error("Failed to delete conversation:", error);
        // Show error toast
        setToastType("error");
        setToastMessage("Failed to delete conversation");
        setShowToast(true);
      }
    }
    setDeleteModalState({
      isVisible: false,
      conversationId: "",
      conversationName: "",
    });
  };

  const handleConversationUpdate = (
    id: string,
    newName: string,
    newETag?: string,
  ) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === id
          ? { ...conv, name: newName, eTag: newETag || conv.eTag }
          : conv,
      ),
    );
  };

  return (
    <div
      className="min-h-screen bg-gray-50 flex"
      style={{ ["--sidebar-offset" as any]: isSidebarOpen ? "20rem" : "0" }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? isMobile
              ? "w-full translate-x-0"
              : "w-80 translate-x-0"
            : "w-0 -translate-x-full"
        } ${isMobile && isSidebarOpen ? "shadow-lg" : ""} overflow-x-hidden`}
      >
        {/* Sidebar Header */}
        <SidebarHeader
          isMobile={isMobile}
          isSidebarOpen={isSidebarOpen}
          session={session as any}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
        />

        {/* Sidebar Content */}
        <SidebarContent
          isSidebarOpen={isSidebarOpen}
          isMobile={isMobile}
          isLoadingApiCollections={isLoadingApiCollections}
          isLoadingExtraCollections={isLoadingExtraCollections}
          finalSortedCollections={getCollectionsWithDefaultOrder()}
          extraCollections={extraCollections}
          session={session}
          currentConversationId={currentConversationId}
          conversations={conversations}
          onCollectionSettingsOpen={() => setIsCollectionSettingsOpen(true)}
          onMobileSidebarClose={() => isMobile && setIsSidebarOpen(false)}
          onCollectionAskQuestion={handleCollectionAskQuestion}
          onDeleteConversation={handleDeleteConversation}
          onConversationUpdate={handleConversationUpdate}
          setConversations={setConversations}
        />
      </aside>

      {/* Mobile overlay removed for full-width sidebar without backdrop */}

      {/* Main content area */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && !isMobile ? "ml-80" : "ml-0"
        }`}
      >
        {/* Header */}
        <MainHeader
          isMobile={isMobile}
          isSidebarOpen={isSidebarOpen}
          session={session as any}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="bg-white min-h-[calc(100vh-56px)]">{children}</main>
      </div>

      {/* Collection Settings Modal */}
      <CollectionSettingsModal
        isVisible={isCollectionSettingsOpen}
        onClose={() => setIsCollectionSettingsOpen(false)}
      />

      {/* Delete Conversation Modal */}
      <ConfirmationModal
        isVisible={deleteModalState.isVisible}
        onClose={() =>
          setDeleteModalState({
            isVisible: false,
            conversationId: "",
            conversationName: "",
          })
        }
        onConfirm={handleConfirmDeleteConversation}
        title="Delete Chat"
        message1={`Are you sure you want to delete "${deleteModalState.conversationName}"?`}
        message2="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        icon={<Trash strokeWidth={2.5} className="w-8 h-8 text-red-550" />}
        isLoading={false}
      />

      {/* Toast for notifications */}
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        type={toastType}
      />
    </div>
  );
}
