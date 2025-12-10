/**
 * Dynamic environment variables for Next.js.
 * - PUBLIC_* → client + server (via window.__env)
 * - Non-prefixed → server-only (process.env)
 */

export const isBrowser = (): boolean => typeof window !== "undefined";
export const isServer = (): boolean => typeof window === "undefined";

/** Get a PUBLIC_* env var. Works on client and server. Key without PUBLIC_ prefix. */
export function publicEnv(key: string, defaultValue?: string): string {
  const fullKey = `PUBLIC_${key}`;

  if (isBrowser()) {
    const value = window.__env?.[fullKey];
    if (value !== undefined) return value === "''" ? "" : value;
  }

  const value = process.env[fullKey];
  if (value !== undefined) return value === "''" ? "" : value;
  if (defaultValue !== undefined) return defaultValue;

  if (process.env.NODE_ENV === "development") {
    console.warn(`[env] Missing PUBLIC_${key}`);
  }
  return "";
}

/** Get a server-only env var. Throws if called in browser. */
export function serverEnv(key: string, defaultValue?: string): string {
  if (isBrowser()) {
    throw new Error(`[env] Server-only variable "${key}" accessed on client`);
  }

  const value = process.env[key];
  if (value !== undefined) return value === "''" ? "" : value;
  if (defaultValue !== undefined) return defaultValue;

  if (process.env.NODE_ENV === "development") {
    console.warn(`[env] Missing ${key}`);
  }
  return "";
}

/** Auto-routes to publicEnv or serverEnv based on PUBLIC_ prefix. */
export function env(key: string, defaultValue?: string): string {
  if (key.startsWith("PUBLIC_")) {
    return publicEnv(key.replace("PUBLIC_", ""), defaultValue);
  }
  return serverEnv(key, defaultValue);
}

// Typed getters
export const getApiBaseUrl = () =>
  publicEnv("DATAGEMS_API_BASE_URL", "https://datagems-dev.scayle.es");
export const getAppBaseUrl = () =>
  publicEnv("APP_BASE_URL", "http://localhost:3000");
export const getAppName = () => publicEnv("APP_NAME", "DataGEMS");

/** Debug: log all PUBLIC_* vars */
export function debugPublicEnv(): void {
  const source = isBrowser() && window.__env ? window.__env : process.env;
  const vars = Object.entries(source).filter(([k]) => k.startsWith("PUBLIC_"));
  console.log("[env] PUBLIC_* vars:", vars);
}
