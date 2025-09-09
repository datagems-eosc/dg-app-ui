import { Menu, PanelLeftOpen } from "lucide-react";
import { Logo } from "./Logo";
import { UserProfileDropdown } from "./UserProfileDropdown";

interface MainHeaderProps {
  isMobile: boolean;
  isSidebarOpen: boolean;
  session: any;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function MainHeader({
  isMobile,
  isSidebarOpen,
  session,
  onToggleSidebar,
  onLogout,
}: MainHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-18">
      <div
        className={`h-full px-4 md:px-6 flex ${
          isSidebarOpen ? "justify-end" : "justify-between"
        } items-center`}
      >
        {/* Left side - Logo and toggle when sidebar is closed */}
        {!isSidebarOpen && (
          <div
            className={`flex items-center gap-4 transition-all duration-300 ${
              isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <button
              onClick={onToggleSidebar}
              className={`hover:bg-gray-100 transition-colors ${isMobile ? "rounded-lg border border-gray-300 p-1" : "p-2 rounded-md"}`}
              aria-label="Open sidebar"
            >
              {isMobile ? (
                <Menu strokeWidth={1.25} className="w-5 h-5 text-icon" />
              ) : (
                <PanelLeftOpen
                  strokeWidth={1.25}
                  className="w-5 h-5 text-icon"
                />
              )}
            </button>
            <Logo isMobile={isMobile} />
          </div>
        )}

        {/* Right side - User info */}
        <UserProfileDropdown
          session={session}
          isMobile={isMobile}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
