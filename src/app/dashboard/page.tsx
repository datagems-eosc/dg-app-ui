import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import ProtectedPage from "@/components/ProtectedPage";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-96">
            Loading...
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </ProtectedPage>
  );
}
