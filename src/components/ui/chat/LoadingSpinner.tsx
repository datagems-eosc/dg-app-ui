"use client";

import React from "react";

export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-blue-700 text-body-16-medium">
          Loading messages...
        </span>
      </div>
    </div>
  );
}
