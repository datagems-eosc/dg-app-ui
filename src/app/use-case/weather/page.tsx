"use client";

import UseCasePageClient from "../UseCasePageClient";

export default function WeatherPage() {
  return (
    <UseCasePageClient
      collectionName="Weather"
      title="Weather Datasets"
      subtitle="Weather dataset collection"
    />
  );
}
