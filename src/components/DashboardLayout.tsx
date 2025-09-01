"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  Calculator,
  Languages,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  FolderSearch,
  Bot,
  CloudSun,
  GraduationCap,
  Package,
  Trash,
} from "lucide-react";
import { Dropdown, DropdownItem } from "./ui/Dropdown";
import { Avatar } from "./ui/Avatar";
import { MenuItem } from "./ui/MenuItem";
import { CollectionItem } from "./ui/CollectionItem";
import { useCollections } from "@/contexts/CollectionsContext";
import { useSession } from "next-auth/react";
import { createUrl } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { ApiCollection } from "@/types/collection";
import { ChatHistoryList } from "./ui/chat/ChatHistoryList";
import {
  APP_ROUTES,
  generateDashboardUrl,
  generateChatUrl,
} from "@/config/appUrls";
import CollectionSettingsModal from "./CollectionSettingsModal";
import { ConfirmationModal } from "./ui/ConfirmationModal";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const getCollectionIcon = (code?: string, className?: string) => {
  const baseClasses = "w-5 h-5 text-icon";
  const finalClasses = className ? `${baseClasses} ${className}` : baseClasses;

  if (!code) return <Package strokeWidth={1.25} className={finalClasses} />;

  switch (code.toLowerCase()) {
    case "weather":
    case "meteo":
      return <CloudSun strokeWidth={1.25} className={finalClasses} />;
    case "math":
    case "mathe":
      return <Calculator strokeWidth={1.25} className={finalClasses} />;
    case "lifelong":
    case "learning":
      return <GraduationCap strokeWidth={1.25} className={finalClasses} />;
    case "language":
    case "languages":
      return <Languages strokeWidth={1.25} className={finalClasses} />;
    default:
      return <Package strokeWidth={1.25} className={finalClasses} />;
  }
};

// Menu items array
const menuItems = [
  {
    id: "browse",
    label: "Browse",
    href: APP_ROUTES.DASHBOARD,
    icon: FolderSearch,
  },
  {
    id: "ask-question",
    label: "Ask a question",
    href: APP_ROUTES.CHAT,
    icon: Bot,
  },
];

// Component that wraps CollectionItem in Suspense
function CollectionItemWithSuspense(props: any) {
  return (
    <Suspense fallback={<CollectionItemSkeleton />}>
      <CollectionItem {...props} />
    </Suspense>
  );
}

// Component that wraps MenuItem in Suspense
function MenuItemWithSuspense(props: any) {
  return (
    <Suspense fallback={<MenuItemSkeleton />}>
      <MenuItem {...props} />
    </Suspense>
  );
}

// Skeleton for collection item
function CollectionItemSkeleton() {
  return (
    <div className="group relative flex flex-start gap-4 pr-5 min-h-12">
      <div className="flex items-center justify-center">
        <div className="bg-gray-200 w-1 h-[32px] rounded-r-[4px] animate-pulse" />
      </div>
      <div className="flex-1 flex items-center px-3 py-2 rounded-lg bg-gray-200 animate-pulse">
        <div className="w-5 h-5 bg-gray-300 rounded mr-3 animate-pulse" />
        <div className="h-4 bg-gray-300 rounded flex-1 animate-pulse" />
      </div>
    </div>
  );
}

// Skeleton for menu item
function MenuItemSkeleton() {
  return (
    <div className="flex flex-start gap-4 pr-5">
      <div className="flex items-center justify-center">
        <div className="bg-gray-200 w-1 h-[32px] rounded-r-[4px] animate-pulse" />
      </div>
      <div className="flex-1 flex items-center px-3 py-2 rounded-lg bg-gray-200 animate-pulse">
        <div className="w-5 h-5 bg-gray-300 rounded mr-2 animate-pulse" />
        <div className="h-4 bg-gray-300 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasLoadedCollections = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
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
  const handleManualRefresh = () => {
    if (session) {
      refreshAllCollections();
    }
  };

  // Function to sort and filter collections based on localStorage settings
  const getSortedAndFilteredCollections = (
    collections: ApiCollection[],
    isExtra = false
  ) => {
    const savedSettings = localStorage.getItem("collectionSettings");
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
    const savedSettings = localStorage.getItem("collectionSettings");

    if (!savedSettings) {
      // When localStorage is empty, return extraCollections first, then apiCollections
      const extraCollectionsWithDefaults = extraCollections.map(
        (collection, index) => ({
          ...collection,
          isVisible: true,
          order: index, // Start ordering from 0 for custom collections
        })
      );

      const apiCollectionsWithDefaults = apiCollections.map(
        (collection, index) => ({
          ...collection,
          isVisible: true,
          order: extraCollectionsWithDefaults.length + index, // Start ordering after custom collections
        })
      );

      return [...extraCollectionsWithDefaults, ...apiCollectionsWithDefaults];
    }

    // When localStorage has settings, use the existing logic but prioritize custom collections
    const customCollections = getSortedAndFilteredCollections(extraCollections);

    const sortedApiCollections =
      getSortedAndFilteredCollections(apiCollections);

    // Combine collections with custom collections first, then API collections
    return [...customCollections, ...sortedApiCollections];
  };

  // Handle mobile detection and sidebar state
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      handleCollectionSettingsChange
    );
    window.addEventListener(
      "forceCollectionsRefresh",
      handleForceCollectionsRefresh
    );

    return () => {
      window.removeEventListener(
        "collectionSettingsChanged",
        handleCollectionSettingsChange
      );
      window.removeEventListener(
        "forceCollectionsRefresh",
        handleForceCollectionsRefresh
      );
    };
  }, [refreshAllCollections]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
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
    conversationName: string
  ) => {
    setDeleteModalState({
      isVisible: true,
      conversationId,
      conversationName,
    });
  };

  const handleConfirmDeleteConversation = async () => {
    const token = (session as any)?.accessToken;
    if (deleteModalState.conversationId && token) {
      try {
        const { apiClient } = await import("@/lib/apiClient");
        await apiClient.deleteConversation(
          deleteModalState.conversationId,
          token
        );
        // The conversation will be automatically removed from the list
        // when the user navigates away or refreshes the page
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
    setDeleteModalState({
      isVisible: false,
      conversationId: "",
      conversationName: "",
    });
  };

  return (
    <div
      className="min-h-screen bg-gray-50 flex"
      style={{ ["--sidebar-offset" as any]: isSidebarOpen ? "20rem" : "0" }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-80 translate-x-0" : "w-0 -translate-x-full"
        } ${isMobile && isSidebarOpen ? "shadow-lg" : ""} overflow-x-hidden`}
      >
        {/* Logo Section - only visible when sidebar is open */}
        {isSidebarOpen && (
          <div className="py-4.5 pl-5 pr-4 flex items-center gap-3">
            <Link
              href={createUrl(APP_ROUTES.DASHBOARD)}
              className="flex items-center gap-2"
            >
              <img
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.svg`}
                alt="Logo"
                className="h-6 w-auto"
              />
            </Link>
            <button
              onClick={toggleSidebar}
              className="ml-auto p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <PanelLeftClose
                strokeWidth={1.25}
                className="w-5 h-5 text-icon"
              />
            </button>
          </div>
        )}

        {/* Sidebar Content */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div className="flex flex-col py-4">
            {/* Menu Section */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h3 className="px-5 text-descriptions-12-medium text-gray-500 uppercase tracking-wider mb-3">
                MENU
              </h3>
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <MenuItemWithSuspense
                    key={item.id}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => isMobile && setIsSidebarOpen(false)}
                  />
                ))}
              </nav>
            </div>

            {/* Collections Section */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <div className="px-5 flex items-center justify-between mb-3">
                <h3 className="text-descriptions-12-medium text-gray-500 uppercase tracking-wider">
                  COLLECTIONS
                </h3>
                <button
                  onClick={() => setIsCollectionSettingsOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Settings
                    strokeWidth={1.25}
                    className="w-4 h-4 text-icon hover:text-gray-600"
                  />
                </button>
              </div>
              <nav className="space-y-1 max-h-54 overflow-y-auto">
                {/* Loading States */}
                {isLoadingApiCollections || isLoadingExtraCollections ? (
                  <div className="flex items-center px-3 py-2 text-body-16-medium text-gray-500">
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Loading collections...
                  </div>
                ) : (
                  <>
                    {/* Combine and sort all collections */}
                    {(() => {
                      const finalSortedCollections =
                        getCollectionsWithDefaultOrder();

                      console.log(
                        "Final sorted collections for sidebar:",
                        finalSortedCollections
                      );

                      return finalSortedCollections.map((collection) => {
                        // Check if this collection is from extraCollections (custom collections)
                        const isExtra = extraCollections.some(
                          (ec) => ec.id === collection.id
                        );

                        return (
                          <CollectionItemWithSuspense
                            key={collection.id}
                            id={collection.id}
                            name={
                              isExtra
                                ? collection.name
                                : collection.name.replace(/ Collection$/i, "")
                            }
                            icon={getCollectionIcon(collection.code)}
                            href={
                              isExtra
                                ? generateDashboardUrl({
                                    collection: collection.id,
                                    isCustom: true,
                                  })
                                : generateDashboardUrl({
                                    collection: collection.id,
                                  })
                            }
                            title={
                              isExtra
                                ? `${collection.userDatasetCollections?.length || 0} datasets`
                                : `${collection.datasetCount} datasets`
                            }
                            onClick={() => isMobile && setIsSidebarOpen(false)}
                            onMessageClick={() =>
                              handleCollectionAskQuestion(collection.id)
                            }
                          />
                        );
                      });
                    })()}
                  </>
                )}
              </nav>
            </div>

            {/* Recent Chats Section */}
            <div className="flex-1 flex flex-col min-h-0 px-5">
              <h3 className="text-descriptions-12-medium text-gray-500 uppercase tracking-wider mb-3">
                RECENT CHATS
              </h3>
              <div className="flex-1 overflow-y-auto">
                <ChatHistoryList
                  session={session}
                  currentConversationId={currentConversationId}
                  onDeleteConversation={handleDeleteConversation}
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div
        className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "ml-80" : "ml-0"}`}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-18">
          <div className="h-full px-6 flex items-center justify-between">
            {/* Left side - Logo and toggle when sidebar is closed */}
            <div
              className={`flex items-center gap-4 transition-all duration-300 ${
                isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen
                  strokeWidth={1.25}
                  className="w-5 h-5 text-icon"
                />
              </button>
              <Link
                href={createUrl(APP_ROUTES.DASHBOARD)}
                className="flex items-center gap-2"
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.svg`}
                  alt="Logo"
                  className="h-6 w-auto"
                />
              </Link>
            </div>

            {/* Right side - User info */}
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-icon" />

              {/* Profile Dropdown */}
              <Dropdown
                trigger={
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={undefined}
                      name={session?.user?.name || ""}
                      email={session?.user?.email || ""}
                      size="sm"
                    />
                    <div className="text-descriptions-12-regular">
                      <div className="text-body-16-medium text-gray-900">
                        {session?.user?.name}
                      </div>
                      <div className="text-descriptions-12-regular text-gray-500">
                        {session?.user?.email}
                      </div>
                    </div>
                  </div>
                }
              >
                <DropdownItem
                  href={createUrl(APP_ROUTES.SETTINGS)}
                  icon={<Settings className="w-4 h-4 text-icon" />}
                >
                  Settings
                </DropdownItem>
                <DropdownItem
                  onClick={handleLogout}
                  icon={<LogOut className="w-4 h-4 text-icon" />}
                >
                  Logout
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </header>

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
    </div>
  );
}
