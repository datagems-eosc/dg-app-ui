"use client";

import { FEATURE_FLAGS } from "@/config/featureFlags";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { FeatureFlagRow } from "./FeatureFlagRow";

export function FeatureFlagsManager() {
  const { flags, setOverride, datasetIds, setDatasetOverride } =
    useFeatureFlags();

  return (
    <div className="flex min-h-full justify-center bg-[#f5f7fa] px-4 py-6">
      <div className="w-full max-w-[900px] rounded-xl bg-white p-8 shadow-[0px_2px_4px_rgba(0,0,0,0.08)]">
        <h1 className="mb-8 text-[32px] font-medium leading-[1.2] text-gray-750">
          Feature flags
        </h1>
        <div className="overflow-hidden rounded-lg border border-[#e5e9ef]">
          <div className="flex items-center gap-4 bg-[#f8f9fb] px-5 py-4 text-body-14-medium text-[#566b88]">
            <span className="flex-1">Feature name</span>
            <span className="w-[120px]">Current value</span>
            <span className="w-[88px] text-right">Edit</span>
          </div>
          {FEATURE_FLAGS.map((flag) => {
            const hasDatasetId = flag.defaultDatasetId !== undefined;
            return (
              <FeatureFlagRow
                key={flag.id}
                label={flag.label}
                value={flags[flag.id]}
                onSave={(next) => setOverride(flag.id, next)}
                {...(hasDatasetId && {
                  datasetId: datasetIds[flag.id] ?? null,
                  onSaveDatasetId: (value) =>
                    setDatasetOverride(flag.id, value),
                })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
