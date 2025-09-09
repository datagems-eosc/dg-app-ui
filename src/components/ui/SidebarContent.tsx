import React, { Suspense } from "react";
import { 
  Settings, 
  Star, 
  CloudSun, 
  Calculator, 
  GraduationCap, 
  Languages,
  FolderSearch,
  Bot
} from "lucide-react";
import { MenuItem } from "./MenuItem";
import { CollectionItem } from "./CollectionItem";
import { ApiCollection } from "@/types/collection";
import { ChatHistoryList } from "./chat/ChatHistoryList";
import { generateDashboardUrl, APP_ROUTES } from "@/config/appUrls";
import { createUrl } from "@/lib/utils";

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

const getCollectionIcon = (code?: string, className?: string) => {
  const baseClasses = "w-5 h-5 text-icon";
  const finalClasses = className ? `${baseClasses} ${className}` : baseClasses;

  if (!code) return <Star strokeWidth={1.25} className={finalClasses} />;

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
      return <Star strokeWidth={1.25} className={finalClasses} />;
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

interface SidebarContentProps {
  isSidebarOpen: boolean;
  isMobile: boolean;
  isLoadingApiCollections: boolean;
  isLoadingExtraCollections: boolean;
  finalSortedCollections: any[];
  extraCollections: ApiCollection[];
  session: any;
  currentConversationId?: string;
  conversations: any[];
  onCollectionSettingsOpen: () => void;
  onMobileSidebarClose: () => void;
  onCollectionAskQuestion: (collectionId: string) => void;
  onDeleteConversation: (conversationId: string, conversationName: string) => void;
  onConversationUpdate: (id: string, newName: string, newETag?: string) => void;
  setConversations: React.Dispatch<React.SetStateAction<any[]>>;
}

export function SidebarContent({
  isSidebarOpen,
  isMobile,
  isLoadingApiCollections,
  isLoadingExtraCollections,
  finalSortedCollections,
  extraCollections,
  session,
  currentConversationId,
  conversations,
  onCollectionSettingsOpen,
  onMobileSidebarClose,
  onCollectionAskQuestion,
  onDeleteConversation,
  onConversationUpdate,
  setConversations,
}: SidebarContentProps) {
  return (
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
                onClick={onMobileSidebarClose}
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
              onClick={onCollectionSettingsOpen}
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
                {finalSortedCollections.map((collection) => {
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
                      onClick={onMobileSidebarClose}
                      onMessageClick={() =>
                        onCollectionAskQuestion(collection.id)
                      }
                    />
                  );
                })}
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
