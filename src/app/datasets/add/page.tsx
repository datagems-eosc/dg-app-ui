"use client";

import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AddDatasetForm from "@/components/AddDatasetForm";

export default function AddDatasetPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto relative transition-all duration-500 ease-out py-4 sm:py-10 px-4 sm:px-6">
        <div className="mb-4">
          <h1 className="text-H2-32-semibold sm:text-H2-24-semibold text-gray-750">
            Add new dataset
          </h1>
          <p className="text-H2-20-regular text-gray-650">
            Fill in the details and upload your dataset
          </p>
        </div>

        <AddDatasetForm />
      </div>
    </DashboardLayout>
  );
}
