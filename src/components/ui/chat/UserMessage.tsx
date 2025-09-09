"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { Avatar } from "../Avatar";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  const { data: session } = useSession();

  return (
    <div className="flex justify-end items-end gap-3 sm:gap-4">
      <div className="bg-slate-75 text-slate-850 rounded-4xl px-4 py-2.5 sm:px-6 sm:py-3 max-w-[85%] sm:max-w-xl text-body-16-regular break-words overflow-hidden">
        {content}
      </div>
      <Avatar
        src={undefined}
        name={session?.user?.name || ""}
        email={session?.user?.email || ""}
        size="md"
        className="self-start"
      />
    </div>
  );
}
