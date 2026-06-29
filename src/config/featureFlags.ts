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
  | "datasetOnboarding";

export interface FeatureFlagDefinition {
  id: FeatureFlagId;
  label: string;
  defaults: Record<DeploymentEnv, boolean>;
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
    defaults: standardDefaults(),
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
] as const;

export const FEATURE_FLAG_IDS: readonly FeatureFlagId[] = FEATURE_FLAGS.map(
  (flag) => flag.id,
);

export function getFeatureFlagDefinition(
  id: FeatureFlagId,
): FeatureFlagDefinition | undefined {
  return FEATURE_FLAGS.find((flag) => flag.id === id);
}
