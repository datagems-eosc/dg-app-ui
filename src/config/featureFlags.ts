export type DeploymentEnv = "playground" | "staging" | "production";

export type FeatureFlagId =
  | "datasetRecommendation"
  | "questionRecommendation"
  | "customCollection"
  | "generalChat"
  | "expertMode"
  | "datasetPackage"
  | "useCaseWeather"
  | "useCaseMath"
  | "useCaseLifelongLearning"
  | "useCaseLanguage"
  | "datasetOnboarding"
  | "pinnedDatasetWeather"
  | "pinnedDatasetLanguage"
  | "pinnedDatasetMath";

export interface FeatureFlagDefinition {
  id: FeatureFlagId;
  label: string;
  defaults: Record<DeploymentEnv, boolean>;
  defaultDatasetId?: Record<DeploymentEnv, string | null>;
}

const enabledEverywhere = (): Record<DeploymentEnv, boolean> => ({
  playground: true,
  staging: true,
  production: true,
});

const disabledEverywhere = (): Record<DeploymentEnv, boolean> => ({
  playground: false,
  staging: false,
  production: false,
});

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    id: "datasetRecommendation",
    label: "Dataset recommendation",
    defaults: enabledEverywhere(),
  },
  {
    id: "questionRecommendation",
    label: "Question recommendation",
    defaults: enabledEverywhere(),
  },
  {
    id: "customCollection",
    label: "Custom collection",
    defaults: disabledEverywhere(),
  },
  {
    id: "generalChat",
    label: "Hide general chat",
    // DG-238: the Dashboard is the entry point, so "Ask a Question" (general
    // chat) is hidden by default; re-enable per browser via the flags manager.
    defaults: enabledEverywhere(),
  },
  {
    id: "expertMode",
    label: "Expert mode",
    defaults: enabledEverywhere(),
  },
  {
    id: "datasetPackage",
    label: "Dataset packaging",
    defaults: enabledEverywhere(),
  },
  {
    id: "useCaseWeather",
    label: "Use case – Weather",
    defaults: enabledEverywhere(),
  },
  {
    id: "useCaseMath",
    label: "Use case – Math",
    defaults: enabledEverywhere(),
  },
  {
    id: "useCaseLifelongLearning",
    label: "Use case – Lifelong learning",
    defaults: enabledEverywhere(),
  },
  {
    id: "useCaseLanguage",
    label: "Use case – Language",
    defaults: enabledEverywhere(),
  },
  {
    id: "datasetOnboarding",
    label: "Dataset onboarding",
    defaults: enabledEverywhere(),
  },
  {
    id: "pinnedDatasetWeather",
    label: "Use case – Weather - Dataset ID",
    defaults: disabledEverywhere(),
    defaultDatasetId: {
      playground: "3166e649-54c1-4ebf-904e-de9a46cb1b18",
      staging: "3166e649-54c1-4ebf-904e-de9a46cb1b18",
      production: "ecd7c0eb-fbfe-4d61-bfed-df8048f648ed",
    },
  },
  {
    id: "pinnedDatasetLanguage",
    label: "Use case – Language - Dataset ID",
    defaults: disabledEverywhere(),
    defaultDatasetId: {
      playground: "d84d1a2e-127d-4393-91d0-afb7e4fd9c68",
      staging: "d84d1a2e-127d-4393-91d0-afb7e4fd9c68",
      production: "d84d1a2e-127d-4393-91d0-afb7e4fd9c68",
    },
  },
  {
    id: "pinnedDatasetMath",
    label: "Use case – Math - Dataset ID",
    defaults: disabledEverywhere(),
    defaultDatasetId: {
      playground: null,
      staging: null,
      production: null,
    },
  },
] as const;

export const FEATURE_FLAG_IDS: readonly FeatureFlagId[] = FEATURE_FLAGS.map(
  (flag) => flag.id,
);

export function getFeatureFlagDefinition(
  id: FeatureFlagId,
): FeatureFlagDefinition | undefined {
  return FEATURE_FLAGS.find((flag) => flag.id === id);
}
