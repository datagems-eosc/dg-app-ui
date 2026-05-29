import DashboardLayout from "@/components/DashboardLayout";
import LanguageTabBar from "./LanguageTabBar";

export default function LanguageWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
        <LanguageTabBar />
        <div className="flex-1">{children}</div>
      </div>
    </DashboardLayout>
  );
}
