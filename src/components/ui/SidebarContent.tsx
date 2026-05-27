"use client";
import {
  Calculator,
  CloudSun,
  FolderSearch,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Star,
} from "lucide-react";
import type React from "react";
import { Suspense } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import { ChatHistoryList } from "./chat/ChatHistoryList";
import { MenuItem } from "./MenuItem";

// Component that wraps MenuItem in Suspense
function MenuItemWithSuspense(props: any) {
  return (
    <Suspense fallback={<MenuItemSkeleton />}>
      <MenuItem {...props} />
    </Suspense>
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

const menuItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: APP_ROUTES.DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    id: "browse",
    label: "Browse",
    href: APP_ROUTES.BROWSE,
    icon: FolderSearch,
  },
  {
    id: "favourites",
    label: "Favourites",
    href: APP_ROUTES.COLLECTIONS.FAVORITES,
    icon: Star,
  },
];

const useCaseItems = [
  {
    id: "weather",
    label: "Weather",
    href: APP_ROUTES.COLLECTIONS.WEATHER,
    icon: CloudSun,
  },
  {
    id: "math",
    label: "Math",
    href: APP_ROUTES.COLLECTIONS.MATH,
    icon: Calculator,
  },
  {
    id: "lifelong-learning",
    label: "Lifelong Learning",
    href: APP_ROUTES.COLLECTIONS.LIFELONG_LEARNING,
    icon: GraduationCap,
  },
  {
    id: "language",
    label: "Language",
    href: APP_ROUTES.COLLECTIONS.LANGUAGE,
    icon: Languages,
  },
];

interface SidebarContentProps {
  isSidebarOpen: boolean;
  isMobile: boolean;
  session: any;
  currentConversationId?: string;
  conversations: any[];
  onMobileSidebarClose: () => void;
  onDeleteConversation: (
    conversationId: string,
    conversationName: string,
  ) => void;
  onConversationUpdate: (id: string, newName: string, newETag?: string) => void;
  setConversations: React.Dispatch<React.SetStateAction<any[]>>;
}

export function SidebarContent({
  isSidebarOpen,
  isMobile,
  session,
  currentConversationId,
  conversations,
  onMobileSidebarClose,
  onDeleteConversation,
  onConversationUpdate,
  setConversations,
}: SidebarContentProps) {
  return (
    <div
      className={`flex-1 min-h-0 overflow-y-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="flex flex-col h-full py-4">
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
                onClick={onMobileSidebarClose}
              />
            ))}
          </nav>
        </div>

        {/* Use-Cases Section */}
        <div className="mb-4 pb-4 border-b border-slate-200">
          <h3 className="px-5 text-descriptions-12-medium text-gray-500 uppercase tracking-wider mb-3">
            USE-CASES
          </h3>
          <nav className="space-y-2">
            {useCaseItems.map((item) => (
              <MenuItemWithSuspense
                key={item.id}
                href={item.href}
                icon={item.icon}
                label={item.label}
                onClick={onMobileSidebarClose}
              />
            ))}
          </nav>
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-descriptions-12-medium text-gray-500 uppercase tracking-wider mb-3 px-5">
            RECENT CHATS
          </h3>
          <div className="flex-1 overflow-y-auto">
            <ChatHistoryList
              session={session}
              currentConversationId={currentConversationId}
              onDeleteConversation={onDeleteConversation}
              onConversationUpdate={onConversationUpdate}
              conversations={conversations}
              setConversations={setConversations}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
