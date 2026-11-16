"use client";

import UseCasePageClient from "../../UseCasePageClient";

export default function WeatherDatasetsPage() {
  return (
    <UseCasePageClient
      collectionName="Meteo"
      title="Weather Datasets"
      subtitle="Weather dataset collection"
      withLayout={false}
    />
  );
}
