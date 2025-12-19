import { Suspense } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import BrowseClient from "./BrowseClient";

export default function BrowsePage() {
  return (
    <ProtectedPage>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dataset...</p>
            </div>
          </div>
        }
      >
        <BrowseClient />
      </Suspense>
    </ProtectedPage>
  );
}
