"use client";

import LoginScreen from "@/components/LoginScreen";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getNavigationUrl } from "@/lib/utils";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getNavigationUrl("/dashboard"));
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-96">Loading...</div>
    );
  }

  return <LoginScreen />;
}
