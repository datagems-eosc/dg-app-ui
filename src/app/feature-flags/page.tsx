import DashboardLayout from "@/components/DashboardLayout";
import { FeatureFlagsManager } from "@/components/FeatureFlagsManager";

export default function FeatureFlagsPage() {
  return (
    <DashboardLayout>
      <FeatureFlagsManager />
    </DashboardLayout>
  );
}
