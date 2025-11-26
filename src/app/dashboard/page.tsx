import { Suspense } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import DashboardClient from "./DashboardClient";

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
