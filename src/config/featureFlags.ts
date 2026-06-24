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

const standardDefaults = (): Record<DeploymentEnv, boolean> => ({
  playground: true,
  staging: false,
  production: false,
});

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    id: "datasetRecommendation",
    label: "Dataset recommendation",
    defaults: standardDefaults(),
  },
  {
    id: "questionRecommendation",
    label: "Question recommendation",
    defaults: standardDefaults(),
  },
  {
    id: "customCollection",
    label: "Custom collection",
    defaults: standardDefaults(),
  },
  {
    id: "generalChat",
    label: "General chat",
    defaults: standardDefaults(),
  },
  {
    id: "expertMode",
    label: "Expert mode",
    defaults: standardDefaults(),
  },
  {
    id: "datasetPackage",
    label: "Dataset packaging",
    defaults: standardDefaults(),
  },
  {
    id: "useCaseWeather",
    label: "Use case – Weather",
    defaults: standardDefaults(),
  },
  {
    id: "useCaseMath",
    label: "Use case – Math",
    defaults: standardDefaults(),
  },
  {
    id: "useCaseLifelongLearning",
    label: "Use case – Lifelong learning",
    defaults: standardDefaults(),
  },
  {
    id: "useCaseLanguage",
    label: "Use case – Language",
    defaults: standardDefaults(),
  },
  {
    id: "datasetOnboarding",
    label: "Dataset onboarding",
    defaults: standardDefaults(),
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
