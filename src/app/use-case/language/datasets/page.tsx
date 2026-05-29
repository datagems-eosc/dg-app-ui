"use client";

import UseCasePageClient from "../../UseCasePageClient";

export default function LanguageDatasetsPage() {
  return (
    <UseCasePageClient
      collectionName="Language"
      title="Language Datasets"
      subtitle="Language dataset collection"
      withLayout={false}
    />
  );
}
