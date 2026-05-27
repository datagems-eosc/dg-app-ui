import { Suspense } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </ProtectedPage>
  );
}
