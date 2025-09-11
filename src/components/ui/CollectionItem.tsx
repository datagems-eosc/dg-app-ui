import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircleMore } from "lucide-react";
import { createUrl } from "@/lib/utils";

interface CollectionItemProps {
  id: string;
  name: string;
  icon: React.ReactNode;
  href: string;
  title: string;
  onClick?: () => void;
  onMessageClick?: () => void;
}

export function CollectionItem({
  id,
  name,
  icon,
  href,
  title,
  onClick,
  onMessageClick,
}: CollectionItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract collection ID from href and check if it matches current collection
  const getCollectionIdFromHref = (href: string): string | null => {
    const url = new URL(href, window.location.origin);
    return url.searchParams.get("collection");
  };

  const currentCollectionId = searchParams?.get("collection");
  const hrefCollectionId = getCollectionIdFromHref(href);

  // Mark active ONLY on dashboard when the collection param matches
  const isActive =
    pathname.startsWith("/dashboard") &&
    !!currentCollectionId &&
    hrefCollectionId === currentCollectionId;

  const handleMessageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMessageClick) {
      onMessageClick();
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className="group relative flex flex-start gap-4 pr-5 min-h-12">
      <div className="flex items-center justify-center">
        <div
          className={`bg-blue-500 w-1 h-[32px] rounded-r-[4px] ${
            isActive ? "bg-blue-600" : "bg-white"
          }`}
        />
      </div>
      <Link
        href={createUrl(href)}
        className={`flex-1 flex items-center px-3 py-2 text-body-16-medium rounded-lg transition-colors relative ${
          isActive ? "bg-blue-75" : "text-gray-700 hover:bg-slate-75"
        }`}
        title={title}
        onClick={handleLinkClick}
      >
        <span className={`mr-3 ${isActive ? "text-blue-850" : "text-icon"}`}>
          {icon}
        </span>
        <span className="flex-1 truncate max-w-[165px]">{name}</span>
        {onMessageClick && (
          <button
            onClick={handleMessageClick}
            className="ml-2 p-2 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white"
            title="Ask a question about this collection"
          >
            <MessageCircleMore
              className="w-5 h-5 text-icon"
              strokeWidth={1.25}
            />
          </button>
        )}
      </Link>
    </div>
  );
}
