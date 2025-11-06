"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import React from "react";
import { logger } from "@/lib/logger";

export default function ProtectedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  useEffect(() => {
    logger.debug({ status, session }, "ProtectedPage status");
    if (status === "unauthenticated") {
      logger.info({
        windowLocation:
          typeof window !== "undefined" ? window.location.href : null,
      }, "ProtectedPage signIn called");
      signIn();
    }
  }, [status]);

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
