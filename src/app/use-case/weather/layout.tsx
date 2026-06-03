import DashboardLayout from "@/components/DashboardLayout";
import { FeatureFlagGuard } from "@/components/FeatureFlagGuard";
import WeatherTabBar from "./WeatherTabBar";

export default function WeatherWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <FeatureFlagGuard flag="useCaseWeather">
        <div className="flex flex-col min-h-[calc(100vh-56px)]">
          <WeatherTabBar />
          <div className="flex-1">{children}</div>
        </div>
      </FeatureFlagGuard>
    </DashboardLayout>
  );
}
