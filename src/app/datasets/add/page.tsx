"use client";

import AddDatasetForm from "@/components/AddDatasetForm/AddDatasetForm";
import DashboardLayout from "@/components/DashboardLayout/DashboardLayout";

export default function AddDatasetPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto relative transition-all duration-500 ease-out py-4 sm:py-6 lg:py-10 px-4 sm:px-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-H2-24-semibold sm:text-H2-32-semibold text-gray-750">
            Add new dataset
          </h1>
          <p className="text-body-14-regular sm:text-H2-20-regular text-gray-650 mt-2">
            Fill in the details and upload your dataset
          </p>
        </div>

        <AddDatasetForm />
      </div>
    </DashboardLayout>
  );
}
