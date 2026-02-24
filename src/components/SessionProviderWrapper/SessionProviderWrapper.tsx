"use client";

import { SessionProvider, signIn, useSession } from "next-auth/react";
import { type ReactNode, useEffect } from "react";
import { publicEnv } from "@/lib/env";
import { logDebug } from "@/lib/logger";

// Get the base URL including the base path for NextAuth
const _getBaseUrl = () => {
  const basePath = publicEnv("BASE_PATH", "");
  const baseUrl = publicEnv("APP_BASE_URL", "http://localhost:3000");
  return `${baseUrl}${basePath}`;
};

// Component to handle session errors and automatic re-authentication
function SessionErrorHandler({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    // Check if there's a session error that requires re-authentication
    if (session && (session as any).error === "RefreshAccessTokenError") {
      logDebug("Token refresh failed, triggering re-authentication");
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
      basePath={`${publicEnv("BASE_PATH", "")}/api/auth`}
      // Enable automatic token refresh
      refetchInterval={60} // Refetch session every 1 minute
      refetchOnWindowFocus={true} // Refetch when window gains focus
    >
      <SessionErrorHandler>{children}</SessionErrorHandler>
    </SessionProvider>
  );
}
