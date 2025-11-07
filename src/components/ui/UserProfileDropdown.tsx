import { Bell, LogOut, Settings } from "lucide-react";
import { APP_ROUTES } from "@/config/appUrls";
import { createUrl } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Dropdown, DropdownItem } from "./Dropdown";

interface UserProfileDropdownProps {
  session: any;
  isMobile?: boolean;
  onLogout: () => void;
}

export function UserProfileDropdown({
  session,
  isMobile = false,
  onLogout,
}: UserProfileDropdownProps) {
  return (
    <div className="flex items-center gap-3">
      <Bell className="w-5 h-5 text-icon" />

      {/* Profile Dropdown */}
      <Dropdown
        trigger={
          <div className="flex items-center gap-2">
            <Avatar
              src={undefined}
              name={session?.user?.name || ""}
              email={session?.user?.email || ""}
              size="smPlus"
              className={isMobile ? "w-9 h-9 flex-shrink-0" : ""}
            />
            {!isMobile && (
              <div className="flex flex-col items-start">
                <div className="text-body-14-medium text-gray-750">
                  {session?.user?.name}
                </div>
                <div className="text-descriptions-12-regular tracking-1p text-gray-650">
                  {session?.user?.email}
                </div>
              </div>
            )}
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
          onClick={onLogout}
          icon={<LogOut className="w-4 h-4 text-icon" />}
        >
          Logout
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
