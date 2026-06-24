"use client";

import { FeatureFlagGuard } from "@/components/FeatureFlagGuard";
import UseCasePageClient from "../UseCasePageClient";

export default function LifelongLearningPage() {
  return (
    <FeatureFlagGuard flag="useCaseLifelongLearning">
      <UseCasePageClient
        collectionName="Lifelong Learning"
        title="Lifelong Learning Datasets"
        subtitle="Lifelong Learning dataset collection"
      />
    </FeatureFlagGuard>
  );
}
