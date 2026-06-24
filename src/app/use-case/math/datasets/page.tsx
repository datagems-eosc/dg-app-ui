"use client";

import UseCasePageClient from "../../UseCasePageClient";

export default function MathDatasetsPage() {
  return (
    <UseCasePageClient
      collectionName="Math"
      title="Math Datasets"
      subtitle="Math dataset collection"
      withLayout={false}
    />
  );
}
