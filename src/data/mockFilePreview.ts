import type { FilePreviewData } from "@/types/filePreview";

export const mockFilePreviewData: Record<string, FilePreviewData> = {
  "file1-csv": {
    filename: "File1.csv",
    fileSize: "65.04 kB",
    description:
      "A curated archive of long-term weather observations collected by the National Observatory of Athens. The dataset includes temperature, precipitation, humidity, wind patterns, and other atmospheric indicators recorded across Greece. It provides reliable historical trends, supports climate analysis, and enables comparison between past and present weather conditions for research, forecasting, and decision-making.",
    columns: [
      {
        id: "station_id",
        name: "station_id",
        type: "categorical",
        visible: true,
        description: "ID for weather station",
      },
      {
        id: "location",
        name: "location",
        type: "categorical",
        visible: true,
        description: "Geographic location name",
      },
      {
        id: "temperature",
        name: "temperature",
        type: "numeric",
        visible: true,
        description: "Air temperature (°C)",
      },
      {
        id: "precipitation",
        name: "precipitation",
        type: "numeric",
        visible: true,
        description: "Precipitation amount (mm/hour)",
      },
      {
        id: "humidity",
        name: "humidity",
        type: "numeric",
        visible: true,
        description: "Relative humidity (%)",
      },
      {
        id: "wind_speed",
        name: "wind_speed",
        type: "numeric",
        visible: true,
        description: "Wind speed (km/h)",
      },
      {
        id: "pressure",
        name: "pressure",
        type: "numeric",
        visible: true,
        description: "Atmospheric pressure (hPa)",
      },
      {
        id: "date",
        name: "date",
        type: "date",
        visible: true,
        description: "Observation date",
      },
    ],
    rows: Array.from({ length: 250 }, (_, i) => ({
      id: `row-${i}`,
      cells: [
        { columnId: "station_id", value: `WS-${1000 + i}` },
        {
          columnId: "location",
          value: ["Athens", "Thessaloniki", "Patras", "Heraklion"][i % 4],
        },
        {
          columnId: "temperature",
          value: Number((15 + Math.random() * 20).toFixed(1)),
        },
        {
          columnId: "precipitation",
          value: Number((Math.random() * 10).toFixed(1)),
        },
        {
          columnId: "humidity",
          value: Number((40 + Math.random() * 40).toFixed(0)),
        },
        {
          columnId: "wind_speed",
          value: Number((Math.random() * 30).toFixed(1)),
        },
        {
          columnId: "pressure",
          value: Number((990 + Math.random() * 40).toFixed(1)),
        },
        {
          columnId: "date",
          value: `2023-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
        },
      ],
    })),
    totalRows: 1447,
    totalMissingPercentage: 23,
    statistics: [
      {
        columnId: "station_id",
        uniqueValues: 174,
        nullCount: 0,
        missingPercentage: 0,
      },
      {
        columnId: "location",
        uniqueValues: 4,
        nullCount: 0,
        missingPercentage: 0,
        topValues: [
          { value: "Athens", count: 450 },
          { value: "Thessaloniki", count: 380 },
          { value: "Patras", count: 320 },
          { value: "Heraklion", count: 297 },
        ],
      },
      {
        columnId: "temperature",
        uniqueValues: 1500,
        nullCount: 203,
        min: -15.2,
        max: 42.1,
        mean: 18.7,
        median: 19.2,
        stdDev: 8.4,
        missingPercentage: 14,
        distribution: [
          5, 8, 12, 18, 25, 35, 48, 62, 78, 85, 92, 88, 75, 60, 42, 28,
        ],
      },
      {
        columnId: "precipitation",
        uniqueValues: 890,
        nullCount: 463,
        min: 0,
        max: 7.2,
        mean: 2.3,
        median: 1.8,
        stdDev: 1.9,
        missingPercentage: 32,
        distribution: [120, 95, 78, 65, 48, 35, 25, 18, 12, 8],
      },
      {
        columnId: "humidity",
        uniqueValues: 81,
        nullCount: 89,
        min: 23,
        max: 98,
        mean: 65.3,
        median: 67,
        stdDev: 15.2,
        missingPercentage: 6,
        distribution: [
          10, 15, 22, 35, 48, 65, 82, 95, 88, 75, 60, 45, 28, 15, 8, 5,
        ],
      },
      {
        columnId: "wind_speed",
        uniqueValues: 620,
        nullCount: 52,
        min: 0,
        max: 30,
        mean: 12.5,
        median: 11.8,
        stdDev: 5.2,
        missingPercentage: 4,
        distribution: [
          8, 12, 18, 28, 42, 55, 68, 78, 85, 82, 75, 65, 52, 38, 22, 12,
        ],
      },
      {
        columnId: "pressure",
        uniqueValues: 1200,
        nullCount: 18,
        min: 990,
        max: 1030,
        mean: 1013.2,
        median: 1013.5,
        stdDev: 8.7,
        missingPercentage: 1,
        distribution: [
          5, 8, 15, 25, 38, 52, 68, 82, 92, 88, 75, 58, 42, 28, 15, 9,
        ],
      },
    ],
    dataQuality: [
      {
        columnId: "station_id",
        completeness: 100,
        accuracy: 98,
        consistency: 100,
        issues: [],
      },
      {
        columnId: "temperature",
        completeness: 86,
        accuracy: 95,
        consistency: 92,
        issues: [
          {
            type: "missing",
            count: 203,
            description: "Missing temperature readings",
          },
          {
            type: "outlier",
            count: 12,
            description: "Temperature values outside expected range",
          },
        ],
      },
      {
        columnId: "precipitation",
        completeness: 68,
        accuracy: 88,
        consistency: 85,
        issues: [
          {
            type: "missing",
            count: 463,
            description: "Missing precipitation data",
          },
        ],
      },
    ],
  },
  "file2-xlsx": {
    filename: "File2.xlsx",
    fileSize: "892 kB",
    description:
      "This file contains synthetic patient records designed to simulate real healthcare scenarios. It includes patient demographics, visit history, diagnoses, treatments, and outcomes.",
    columns: [
      { id: "patient_id", name: "patient_id", type: "text", visible: true },
      { id: "age", name: "age", type: "number", visible: true },
      { id: "gender", name: "gender", type: "text", visible: true },
      { id: "diagnosis", name: "diagnosis", type: "text", visible: true },
      { id: "treatment", name: "treatment", type: "text", visible: true },
      { id: "outcome", name: "outcome", type: "text", visible: true },
    ],
    rows: Array.from({ length: 150 }, (_, i) => ({
      id: `row-${i}`,
      cells: [
        { columnId: "patient_id", value: `P-${10000 + i}` },
        { columnId: "age", value: 20 + Math.floor(Math.random() * 60) },
        { columnId: "gender", value: i % 2 === 0 ? "Male" : "Female" },
        {
          columnId: "diagnosis",
          value: ["Hypertension", "Diabetes", "Asthma", "Migraine"][i % 4],
        },
        {
          columnId: "treatment",
          value: ["Medication", "Surgery", "Therapy", "Observation"][i % 4],
        },
        {
          columnId: "outcome",
          value: ["Improved", "Stable", "Recovered"][i % 3],
        },
      ],
    })),
    totalRows: 2834,
    totalMissingPercentage: 18,
    statistics: [],
    dataQuality: [],
  },
};

export const getFilePreviewData = (fileId: string): FilePreviewData | null => {
  return mockFilePreviewData[fileId] || null;
};
