import React from "react";
import DGIcon from "@/components/ui/chat/DGIcon";

export default function ChatInitialView() {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <DGIcon className="w-6 h-6 sm:w-8 sm:h-8 mb-3 sm:mb-1" />
      <h1 className="text-H2-32-semibold text-gray-750 mb-2 sm:mb-1 text-center">
        New Chat
      </h1>
      <p className="text-H2-20-regular text-icon text-center leading-relaxed">
        Ask your question based on added datasets
      </p>
    </div>
  );
}
