import DashboardLayout from "@/components/DashboardLayout";
import { FeatureFlagGuard } from "@/components/FeatureFlagGuard";
import MathTabBar from "./MathTabBar";

export default function MathWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <FeatureFlagGuard flag="useCaseMath">
        <div className="flex flex-col min-h-[calc(100vh-56px)]">
          <MathTabBar />
          <div className="flex-1">{children}</div>
        </div>
      </FeatureFlagGuard>
    </DashboardLayout>
  );
}
