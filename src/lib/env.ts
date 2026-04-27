export const isBrowser = (): boolean => typeof window !== "undefined";
export const isServer = (): boolean => typeof window === "undefined";

type EnvSource = Record<string, string | undefined>;

defineEnvWindow();

function defineEnvWindow(): void {
  if (typeof window === "undefined") return;
  if (typeof window.__env === "undefined") {
    window.__env = {};
  }
}

function readFromSource(source: EnvSource | undefined, key: string) {
  if (!source) return undefined;
  const value = source[key];
  if (value === undefined) return undefined;
  return value === "''" ? "" : value;
}

export function publicEnv(key: string, defaultValue?: string): string {
  const publicKey = `PUBLIC_${key}`;
  const nextPublicKey = `NEXT_PUBLIC_${key}`;

  if (isBrowser()) {
    const fromWindow = readFromSource(window.__env, key);
    if (fromWindow !== undefined) return fromWindow;

    if (defaultValue !== undefined) return defaultValue;

    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV === "development"
    ) {
      console.warn(`[env] Missing ${key}`);
    }

    return "";
  }

  const fromPublic = readFromSource(process.env, publicKey);
  if (fromPublic !== undefined) return fromPublic;
  const fromNextPublic = readFromSource(process.env, nextPublicKey);
  if (fromNextPublic !== undefined) return fromNextPublic;

  if (defaultValue !== undefined) return defaultValue;

  if (process.env.NODE_ENV === "development") {
    console.warn(`[env] Missing PUBLIC_${key}`);
  }

  return "";
}

export function serverEnv(key: string, defaultValue?: string): string {
  if (isBrowser()) {
    throw new Error(`[env] Server-only variable "${key}" accessed on client`);
  }

  const value = readFromSource(process.env, key);
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;

  if (process.env.NODE_ENV === "development") {
    console.warn(`[env] Missing ${key}`);
  }

  return "";
}

export function env(key: string, defaultValue?: string): string {
  if (key.startsWith("PUBLIC_") || key.startsWith("NEXT_PUBLIC_")) {
    const stripped = key.replace(/^NEXT_PUBLIC_/, "").replace(/^PUBLIC_/, "");
    return publicEnv(stripped, defaultValue);
  }
  return serverEnv(key, defaultValue);
}
