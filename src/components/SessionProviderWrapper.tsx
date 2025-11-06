"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { logger } from "@/lib/logger";
const getBaseUrl = () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}${basePath}`;
};

// Component to handle session errors and automatic re-authentication
function SessionErrorHandler({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session && (session as any).error === "RefreshAccessTokenError") {
      logger.warn("Token refresh failed, triggering re-authentication");
      signIn("keycloak");
    }
  }, [session]);

  return <>{children}</>;
}

export default function SessionProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider
      basePath={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth`}
      // Enable automatic token refresh
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window gains focus
    >
      <SessionErrorHandler>{children}</SessionErrorHandler>
    </SessionProvider>
  );
}
