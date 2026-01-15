"use client";

import { signIn, useSession } from "next-auth/react";
import type React from "react";
import { useEffect } from "react";
import { logDebug } from "@/lib/logger";

export default function ProtectedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  useEffect(() => {
    logDebug("ProtectedPage status", { status, hasSession: !!session });
    if (status === "unauthenticated") {
      logDebug("ProtectedPage signIn called", {
        windowLocation:
          typeof window !== "undefined" ? window.location.href : null,
      });
      signIn();
    }
  }, [status, session]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-96">Loading...</div>
    );
  }

  if (!session) {
    // Optionally render nothing or a spinner while redirecting
    return null;
  }

  return <>{children}</>;
}
