/**
 * Application URL configuration
 * Centralized location for all app routes and URL generation
 */

import { publicEnv } from "@/lib/env";

export const APP_ROUTES = {
  // Authentication
  LOGIN: "/login",
  LOGOUT: "/logout",

  // Main pages
  HOME: "/",
  DASHBOARD: "/dashboard",
  BROWSE: "/browse",
  FEATURE_FLAGS: "/feature-flags",
  SETTINGS: "/settings",
  SETTINGS_ROLES: "/settings?tab=roles",
  SETTINGS_ROLES_DATASET: (datasetId: string) =>
    `/settings?tab=roles&datasetId=${encodeURIComponent(datasetId)}`,

  // Chat
  CHAT: "/chat",
  CHAT_WITH_CONVERSATION: (conversationId: string) => `/chat/${conversationId}`,
  CHAT_RCAI: "/chat-rcai",
  CHAT_RCAI_WITH_SESSION: (sessionId: string) => `/chat-rcai/${sessionId}`,

  // Datasets
  DATASET_ADD: "/datasets/add",
  DATASET_DETAILS: (id: string) => `/datasets/${id}`,

  // Collections
  COLLECTIONS: {
    CUSTOM: (id: string) => `/collections/custom/${id}`,
    FAVORITES: "/collections/favorites",
  },

  // Use cases
  USE_CASES: {
    LANGUAGE: "/use-case/language",
    LANGUAGE_HOME: "/use-case/language/home",
    LIFELONG_LEARNING: "/use-case/lifelong-learning",
    MATH: "/use-case/math",
    MATH_HOME: "/use-case/math/home",
    WEATHER: "/use-case/weather",
    WEATHER_HOME: "/use-case/weather/home",
  },
} as const;

export const EXTERNAL_URLS = {
  AAI_ACCOUNT: publicEnv(
    "AAI_ACCOUNT_URL",
    "https://datagems-dev.scayle.es/oauth/realms/dev/account/",
  ),
} as const;

/**
 * Generate URLs with query parameters for browse pages
 */
export const generateBrowseUrl = (params?: {
  collection?: string;
  isCustom?: boolean;
}): string => {
  const baseUrl = APP_ROUTES.BROWSE;
  if (!params) return baseUrl;

  const searchParams = new URLSearchParams();
  if (params.collection) {
    searchParams.set("collection", params.collection);
  }
  if (params.isCustom) {
    searchParams.set("isCustom", "true");
  }

  return searchParams.toString()
    ? `${baseUrl}?${searchParams.toString()}`
    : baseUrl;
};

/**
 * Generate URLs with query parameters for chat pages
 */
export const generateChatUrl = (params?: { collection?: string }): string => {
  const baseUrl = APP_ROUTES.CHAT;
  if (!params?.collection) return baseUrl;

  const searchParams = new URLSearchParams();
  searchParams.set("collection", params.collection);

  return `${baseUrl}?${searchParams.toString()}`;
};
