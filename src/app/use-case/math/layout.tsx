import DashboardLayout from "@/components/DashboardLayout";
import MathTabBar from "./MathTabBar";

export default function MathWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
        <MathTabBar />
        <div className="flex-1">{children}</div>
      </div>
    </DashboardLayout>
  );
}
