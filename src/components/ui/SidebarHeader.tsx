import { X, PanelLeftClose } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfileDropdown } from "./UserProfileDropdown";

interface SidebarHeaderProps {
  isMobile: boolean;
  isSidebarOpen: boolean;
  session: any;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function SidebarHeader({
  isMobile,
  isSidebarOpen,
  session,
  onToggleSidebar,
  onLogout,
}: SidebarHeaderProps) {
  if (!isSidebarOpen) return null;

  if (isMobile) {
    return (
      <div className="py-2.5 px-4 flex items-center justify-between w-full transition-all duration-300 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="hover:bg-gray-100 transition-colors rounded-lg border border-gray-300 p-1"
            aria-label="Open sidebar"
          >
            <X strokeWidth={1.25} className="w-5 h-5 text-icon" />
          </button>
          <Logo isMobile={true} />
        </div>
        <UserProfileDropdown
          session={session}
          isMobile={true}
          onLogout={onLogout}
        />
      </div>
    );
  }

  return (
    <div className="py-4.5 pl-5 pr-4 flex items-center gap-3">
      <Logo />
      <button
        onClick={onToggleSidebar}
        className="ml-auto p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Close sidebar"
      >
        <PanelLeftClose strokeWidth={1.25} className="w-5 h-5 text-icon" />
      </button>
    </div>
  );
}
