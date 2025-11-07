"use client";

import type React from "react";

interface FormSectionLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  errorText?: string;
}

export function FormSectionLayout({
  title,
  description,
  children,
  errorText,
}: FormSectionLayoutProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5">
      <div className="space-y-1 mb-4 sm:mb-6">
        <h2 className="text-H6-18-semibold sm:text-H2-24-semibold text-gray-750">
          {title}
        </h2>
        {description ? (
          <p className="text-body-14-regular sm:text-body-16-regular text-gray-650">
            {description}
          </p>
        ) : null}
      </div>

      {children}

      {errorText ? (
        <p className="mt-3 text-descriptions-12-regular text-red-500">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export default FormSectionLayout;
