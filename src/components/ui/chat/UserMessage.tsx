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
    <div className="flex justify-end items-end gap-4">
      <div className="bg-slate-75 text-slate-850 text-body-16-regular rounded-4xl px-6 py-3 max-w-xl">
        {content}
      </div>
      <Avatar
        src={undefined}
        name={session?.user?.name || ""}
        email={session?.user?.email || ""}
        className="self-start"
      />
    </div>
  );
}
