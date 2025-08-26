/**
 * Application URL configuration
 * Centralized location for all app routes and URL generation
 */

export const APP_ROUTES = {
  // Authentication
  LOGIN: "/login",
  LOGOUT: "/logout",

  // Main pages
  HOME: "/",
  DASHBOARD: "/dashboard",
  BROWSE: "/browse", // Alias for dashboard
  SETTINGS: "/settings",

  // Chat
  CHAT: "/chat",
  CHAT_WITH_CONVERSATION: (conversationId: string) => `/chat/${conversationId}`,

  // Collections
  COLLECTIONS: {
    CUSTOM: (id: string) => `/collections/custom/${id}`,
    FAVORITES: "/collections/favorites",
    LANGUAGE: "/collections/language",
    LIFELONG_LEARNING: "/collections/lifelong-learning",
    MATH: "/collections/math",
    WEATHER: "/collections/weather",
  },
} as const;

/**
 * Generate URLs with query parameters for dashboard/browse pages
 */
export const generateDashboardUrl = (params?: {
  collection?: string;
  isCustom?: boolean;
}): string => {
  const baseUrl = APP_ROUTES.DASHBOARD;
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
