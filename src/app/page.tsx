"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import LoginScreen from "@/components/LoginScreen";
import { APP_ROUTES } from "@/config/appUrls";
import { getNavigationUrl } from "@/lib/utils";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getNavigationUrl(APP_ROUTES.BROWSE));
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-96">Loading...</div>
    );
  }

  return <LoginScreen />;
}
