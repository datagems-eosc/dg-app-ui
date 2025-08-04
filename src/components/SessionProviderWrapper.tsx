"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

// Get the base URL including the base path for NextAuth
const getBaseUrl = () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}${basePath}`;
};

export default function SessionProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider basePath={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth`}>
      {children}
    </SessionProvider>
  );
}
