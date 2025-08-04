"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { getNavigationUrl } from "@/lib/utils";

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: getNavigationUrl("/") });
  }, []);

  return (
    <div className="flex justify-center items-center h-screen">
      <span className="text-lg text-gray-700">Logging out...</span>
    </div>
  );
}
