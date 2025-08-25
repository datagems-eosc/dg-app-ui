"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  Search,
  MessageSquare,
  Cloud,
  Calculator,
  BookOpen,
  Languages,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Dropdown, DropdownItem } from "./ui/Dropdown";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { useCollections } from "@/contexts/CollectionsContext";
import { useSession } from "next-auth/react";
import { createUrl } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { Collection } from "@/types/collection";
import { ChatHistoryList } from "./ui/chat/ChatHistoryList";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const getCollectionIcon = (code: string) => {
  switch (code.toLowerCase()) {
    case "weather":
    case "meteo":
      return <Cloud className="w-4 h-4 mr-3 text-icon" />;
    case "math":
    case "mathe":
      return <Calculator className="w-4 h-4 mr-3 text-icon" />;
    case "lifelong-learning":
    case "learning":
      return <BookOpen className="w-4 h-4 mr-3 text-icon" />;
    case "language":
    case "languages":
      return <Languages className="w-4 h-4 mr-3 text-icon" />;
    default:
      return (
        <span className="w-4 h-4 mr-3 text-descriptions-12-regular">📁</span>
      );
  }
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const {
    apiCollections,
    extraCollections,
    isLoadingApiCollections,
    isLoadingExtraCollections,
  } = useCollections();
  const { data: session } = useSession();

  // Extract conversation ID from pathname if we're on a chat page
  const currentConversationId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : undefined;

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

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 bg-white border-r border-gray-200 min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-80 translate-x-0" : "w-0 -translate-x-full"
        } ${isMobile && isSidebarOpen ? "shadow-lg" : ""} overflow-hidden`}
      >
        {/* Logo Section - only visible when sidebar is open */}
        {isSidebarOpen && (
          <div className="py-4.5 pl-5 pr-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.svg`}
                alt="Logo"
                className="h-6 w-auto"
              />
            </div>
            <button
              onClick={toggleSidebar}
              className="ml-auto p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-5 h-5 text-icon" />
            </button>
          </div>
        )}

        {/* Sidebar Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div className="p-4">
            {/* Menu Section */}
            <div className="mb-8">
              <h3 className="text-descriptions-12-semibold text-gray-500 uppercase tracking-wider mb-3">
                MENU
              </h3>
              <nav className="space-y-1">
                <Link
                  href={createUrl("/dashboard")}
                  className="flex items-center px-3 py-2 text-body-16-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                >
                  <Search className="w-4 h-4 mr-3 text-icon" />
                  Browse
                </Link>
                <Link
                  href={createUrl("/chat")}
                  className="flex items-center px-3 py-2 text-body-16-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                >
                  <MessageSquare className="w-4 h-4 mr-3 text-icon" />
                  Ask a question
                </Link>
              </nav>
            </div>

            {/* Collections Section */}
            <div className="mb-8">
              <h3 className="text-descriptions-12-semibold text-gray-500 uppercase tracking-wider mb-3">
                COLLECTIONS
              </h3>
              <nav className="space-y-1">
                {/* Extra Collections - displayed at the top */}
                {isLoadingExtraCollections ? (
                  <div className="flex items-center px-3 py-2 text-body-16-medium text-gray-500">
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Loading extra collections...
                  </div>
                ) : (
                  extraCollections
                    .filter(
                      (collection) =>
                        collection.userDatasetCollections?.length > 0
                    )
                    .map((collection) => (
                      <Link
                        key={collection.id}
                        href={createUrl(
                          `/dashboard?collection=${collection.id}&isCustom=true`
                        )}
                        className="flex items-center px-3 py-2 text-body-16-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                        title={`${collection.userDatasetCollections?.length || 0} datasets`}
                        onClick={() => isMobile && setIsSidebarOpen(false)}
                      >
                        <span className="w-4 h-4 mr-3 text-descriptions-12-regular">
                          ⭐
                        </span>
                        <span className="truncate">{collection.name}</span>
                        <span className="ml-auto text-descriptions-12-regular text-gray-400">
                          {collection.datasetCount ||
                            collection.userDatasetCollections?.length ||
                            0}
                        </span>
                      </Link>
                    ))
                )}

                {/* Default Collections */}
                {isLoadingApiCollections ? (
                  <div className="flex items-center px-3 py-2 text-body-16-medium text-gray-500">
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Loading collections...
                  </div>
                ) : (
                  apiCollections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={createUrl(`/dashboard?collection=${collection.id}`)}
                      className="flex items-center px-3 py-2 text-body-16-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                      title={`${collection.datasetCount} datasets`}
                      onClick={() => isMobile && setIsSidebarOpen(false)}
                    >
                      {getCollectionIcon(collection.code)}
                      <span className="truncate">
                        {collection.name.replace(/ Collection$/i, "")}
                      </span>
                      <span className="ml-auto text-descriptions-12-regular text-gray-400">
                        {collection.datasetCount}
                      </span>
                    </Link>
                  ))
                )}
              </nav>
            </div>

            {/* Recent Chats Section */}
            <div>
              <h3 className="text-descriptions-12-semibold text-gray-500 uppercase tracking-wider mb-3">
                RECENT CHATS
              </h3>
              <ChatHistoryList
                session={session}
                currentConversationId={currentConversationId}
              />
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
                <PanelLeftOpen className="w-5 h-5 text-icon" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.svg`}
                  alt="Logo"
                  className="h-6 w-auto"
                />
              </div>
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
                  href={createUrl("/settings")}
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
    </div>
  );
}
