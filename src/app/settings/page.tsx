import { Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import UserProfile from "@/components/UserProfile";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <UserProfile />
      </Suspense>
    </DashboardLayout>
  );
}
