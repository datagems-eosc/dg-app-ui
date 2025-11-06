"use client";

import { signIn, useSession } from "next-auth/react";
import type React from "react";
import { useEffect } from "react";

export default function ProtectedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("ProtectedPage status:", { status, session });
    if (status === "unauthenticated") {
      console.log("ProtectedPage signIn called", {
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
