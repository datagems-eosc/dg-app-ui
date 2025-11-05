"use client";

import { X } from "lucide-react";
import type { Dataset } from "@/data/dataset";

interface DataPreviewModalProps {
  isVisible: boolean;
  onClose: () => void;
  dataset: Dataset;
}

// Mock tabular data for the preview
const mockPreviewData = [
  {
    country: "Greece",
    city: "Athens",
    year: "2020",
    zipCode: "92105",
    disaster: "1539",
    casualties: "453",
    casualties2: "453",
  },
  {
    country: "Greece",
    city: "Kallithea",
    year: "2011",
    zipCode: "92103",
    disaster: "1539",
    casualties: "798",
    casualties2: "798",
  },
  {
    country: "Greece",
    city: "Agrinio",
    year: "2018",
    zipCode: "92101",
    disaster: "1539",
    casualties: "423",
    casualties2: "423",
  },
  {
    country: "Greece",
    city: "Alexandroupoli",
    year: "2020",
    zipCode: "92102",
    disaster: "1539",
    casualties: "600",
    casualties2: "600",
  },
  {
    country: "Greece",
    city: "Patras",
    year: "2017",
    zipCode: "92104",
    disaster: "1539",
    casualties: "429",
    casualties2: "429",
  },
  {
    country: "Greece",
    city: "Piraeus",
    year: "1993",
    zipCode: "92102",
    disaster: "1539",
    casualties: "877",
    casualties2: "877",
  },
  {
    country: "Greece",
    city: "Larissa",
    year: "2020",
    zipCode: "92101",
    disaster: "1539",
    casualties: "196",
    casualties2: "196",
  },
  {
    country: "Greece",
    city: "Glyfada",
    year: "2020",
    zipCode: "92101",
    disaster: "1539",
    casualties: "196",
    casualties2: "196",
  },
  {
    country: "Greece",
    city: "Athens",
    year: "2020",
    zipCode: "92101",
    disaster: "1539",
    casualties: "196",
    casualties2: "196",
  },
  {
    country: "Greece",
    city: "Athens",
    year: "2020",
    zipCode: "92101",
    disaster: "1539",
    casualties: "196",
    casualties2: "196",
  },
  {
    country: "Greece",
    city: "Athens",
    year: "2020",
    zipCode: "92101",
    disaster: "1539",
    casualties: "196",
    casualties2: "196",
  },
  {
    country: "Greece",
    city: "Athens",
    year: "2020",
    zipCode: "92102",
    disaster: "1539",
    casualties: "185",
    casualties2: "185",
  },
];

export default function DataPreviewModal({
  isVisible,
  onClose,
  dataset,
}: DataPreviewModalProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 h-full flex items-start justify-center pt-8 pb-8">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-full overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-H2-20-semibold text-gray-900">
                Extreme Drought Events in Greece (2013-2023)
              </h3>
              <p className="text-descriptions-12-regular text-gray-600 mt-1">
                {dataset.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-icon" />
            </button>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Zip Code
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Disaster
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Casualties
                    </th>
                    <th className="px-6 py-3 text-left text-descriptions-12-semibold text-gray-500 uppercase tracking-wider">
                      Casualties
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mockPreviewData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.country}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.city}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.zipCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.disaster}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900 border-r border-gray-200">
                        {row.casualties}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-descriptions-12-regular text-gray-900">
                        {row.casualties2}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <p className="text-descriptions-12-regular text-gray-600">
              Showing {mockPreviewData.length} rows of sample data
            </p>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-descriptions-12-regular text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Download Full Dataset
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-descriptions-12-regular text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
