import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { createUrl } from "@/lib/utils";

interface MenuItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function MenuItem({
  href,
  icon: Icon,
  label,
  onClick,
  className = "",
}: MenuItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Active only on exact path match
  let isActive = pathname === href;
  // Special case: for dashboard, treat as inactive when a collection is selected via query param
  if (href === "/dashboard" && isActive) {
    const collectionId = searchParams?.get("collection");
    if (collectionId) {
      isActive = false;
    }
  }

  return (
    <div className="flex flex-start gap-4 pr-5">
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
          isActive ? "bg-blue-75" : "text-gray-750 hover:bg-slate-75"
        } ${className}`}
        onClick={onClick}
      >
        <Icon
          className={`w-5 h-5 mr-2 ${isActive ? "text-blue-850" : "text-icon"}`}
          strokeWidth={1.25}
        />
        {label}
      </Link>
    </div>
  );
}
