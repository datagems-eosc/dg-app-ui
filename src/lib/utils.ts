import { type ClassValue, clsx } from "clsx";
import { getSession } from "next-auth/react";
import { twMerge } from "tailwind-merge";
import { publicEnv } from "./env";
import { logError } from "./logger";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to handle base path in URLs
export function getBasePath(): string {
  return publicEnv("BASE_PATH", "");
}

// Utility function to create URLs with base path
export function createUrl(path: string): string {
  const basePath = getBasePath();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}

// Utility function for logout redirects with base path
export function getLogoutUrl(): string {
  return createUrl("/logout");
}

// Utility function for navigation with base path
export function getNavigationUrl(path: string): string {
  return createUrl(path);
}

/**
 * Decodes a JWT token and returns the payload
 */
export function decodeJWT(token: string): unknown {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    logError("Failed to decode JWT token", error);
    return null;
  }
}

/**
 * Extracts user information from JWT token
 */
export function getUserFromToken(
  token: string,
): { name: string; email: string; preferred_username?: string } | null {
  const decoded = decodeJWT(token);
  if (!decoded || typeof decoded !== "object" || decoded === null) return null;

  const payload = decoded as Record<string, unknown>;

  return {
    name: String(payload.name || payload.preferred_username || "Unknown User"),
    email: String(payload.email || ""),
    preferred_username: payload.preferred_username
      ? String(payload.preferred_username)
      : undefined,
  };
}

/**
 * Returns the DataGEMS API base URL from environment variables.
 * Falls back to 'https://datagems-dev.scayle.es' if not set.
 */
export function getApiBaseUrl(): string {
  return publicEnv("DATAGEMS_API_BASE_URL", "https://datagems-dev.scayle.es");
}

/**
 * Optional, purely local policy for one authenticated request.
 *
 * It is a separate argument rather than part of `RequestInit` on purpose: it
 * says what this client may do about a 401, which is not a wire concern. No
 * field here is ever sent — not as a fetch option, not as a header, not in a
 * body. Callers that pass nothing keep the behaviour documented on
 * `fetchWithAuth` below, unchanged.
 */
export interface AuthRetryPolicy {
  /**
   * `false` returns the original 401 immediately: no `getSession()`, no second
   * request, no logout redirect. Used by mutations, so that resubmitting stays
   * a decision the caller makes with the outcome in hand. This transport
   * cannot tell which mutation outcomes are safe to repeat, and for the
   * genuinely uncertain ones a silent second attempt could duplicate work the
   * first attempt had already started.
   */
  readonly retryOn401?: boolean;
  /**
   * Refresh and retry only when the refreshed session still belongs to this
   * principal. A new token on its own does not establish that — signing in as
   * somebody else also produces one. When the refreshed `user.id` is absent or
   * different, the original 401 is returned: the request is not retried with
   * another account's credentials, and that account is not logged out either.
   */
  readonly expectedPrincipalId?: string;
}

const abortError = (): DOMException =>
  new DOMException("The operation was aborted.", "AbortError");

/**
 * Only opted-in callers are checked. `fetch` rejects on an already-aborted
 * signal by itself, but everything between the two requests below is awaited
 * application code, and cancellation can land in any of those gaps: while
 * `getSession()` is pending, while the retry is in flight, or after the retry
 * settles but before this function resumes. Each gap ends in an effect a
 * superseded request must not have — a second request, a logout navigation, or
 * a stale response handed back — so each is checked.
 */
const throwIfAborted = (signal: AbortSignal | null | undefined): void => {
  if (signal?.aborted) throw abortError();
};

/**
 * Wrapper for fetch that handles auth on 401 responses:
 *   1. Forces a session refresh via getSession() — NextAuth's JWT callback
 *      runs and exchanges the refresh_token for a new access_token if the
 *      current one has just expired.
 *   2. Retries the original request once with the fresh token.
 *   3. Only if the retry still returns 401 (or refresh itself failed) does
 *      the user get redirected to /logout.
 *
 * Use this for all authenticated API calls in the browser.
 *
 * `policy` is optional and additive: omitting it selects exactly the behaviour
 * above, which is what every existing caller does. Supplying it opts into the
 * narrow guards described on `AuthRetryPolicy` — and only then is the abort
 * signal honoured at each await boundary, so no existing caller's timing
 * changes.
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit,
  policy?: AuthRetryPolicy,
): Promise<Response> {
  const optedIn = policy !== undefined;
  if (optedIn) throwIfAborted(init?.signal);

  let response = await fetch(input, init);

  if (response.status !== 401 || typeof window === "undefined") {
    return response;
  }

  // No-replay callers stop here: the 401 is handed back exactly as received,
  // for the caller to classify. Nothing is refreshed, resent or navigated.
  if (policy?.retryOn401 === false) {
    return response;
  }

  let freshSession: any = null;
  try {
    freshSession = await getSession();
  } catch (error) {
    logError("Session refresh failed during 401 retry", error);
  }

  // Cancelled while the refresh was in flight: no retry, and no redirect.
  if (optedIn) throwIfAborted(init?.signal);

  if (policy?.expectedPrincipalId !== undefined) {
    const refreshedPrincipalId = freshSession?.user?.id;
    if (
      typeof refreshedPrincipalId !== "string" ||
      refreshedPrincipalId.trim() === "" ||
      refreshedPrincipalId !== policy.expectedPrincipalId
    ) {
      // Missing or different principal. The original 401 goes back to the
      // caller: retrying would read one account's data with another's
      // credentials, and forcing a logout would sign out whoever has just
      // signed in. Re-authentication is the caller's decision, not ours.
      return response;
    }
  }

  const newToken: string | undefined = freshSession?.accessToken;
  const refreshFailed = freshSession?.error === "RefreshAccessTokenError";

  if (!newToken || refreshFailed) {
    return forceLogoutResponse();
  }

  const retryHeaders = new Headers(init?.headers);
  const previousToken = retryHeaders
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (previousToken && previousToken === newToken) {
    return forceLogoutResponse();
  }

  retryHeaders.set("Authorization", `Bearer ${newToken}`);
  if (retryHeaders.has("oauth2")) {
    retryHeaders.set("oauth2", newToken);
  }

  response = await fetch(input, { ...init, headers: retryHeaders });

  // Cancelled while the retry was in flight, or between its settlement and
  // this continuation. The retry has already been sent and is not undone —
  // that is not something a client can promise. What is guaranteed is that a
  // superseded operation has no further effect here: it does not navigate the
  // tab away, and it does not hand a late response back to a caller that has
  // moved on. Both remaining outcomes below are such effects, so the check
  // precedes them.
  if (optedIn) throwIfAborted(init?.signal);

  if (response.status === 401) {
    return forceLogoutResponse();
  }

  return response;
}

function forceLogoutResponse(): Response {
  if (window.location.pathname !== getLogoutUrl()) {
    window.location.href = getLogoutUrl();
  }
  return new Response(null, { status: 401, statusText: "Unauthorized" });
}

/**
 * Convert bytes to MB
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Convert MB to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number | string): string {
  const size = typeof bytes === "string" ? Number.parseInt(bytes, 10) : bytes;

  if (Number.isNaN(size)) return "N/A";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let fileSize = size;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Parse size string to bytes
 * Handles formats like "42.6 MB", "1.2 GB", "500 KB", etc.
 */
export function parseSizeString(sizeStr: string): number {
  if (!sizeStr || sizeStr === "N/A") return 0;

  const match = sizeStr.match(/^(\d+\.?\d*)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return 0;

  const value = Number.parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit as keyof typeof multipliers] || 1);
}

/**
 * Format date in human-readable format
 * Returns strings like "Just now", "2 min ago", "1 hour ago", "2 days ago", etc.
 * After 3 days, returns the original date format.
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = typeof date === "string" ? new Date(date) : date;

  // Check if the date is valid
  if (Number.isNaN(targetDate.getTime())) {
    return "Invalid date";
  }

  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000,
  );

  // Just now (less than 1 minute)
  if (diffInSeconds < 60) {
    return "Just now";
  }

  // Minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }

  // Hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  }

  // Days (only show "1 day ago", for 2+ days show date)
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "1 day ago";
  }

  // For 2+ days, return the original date format
  return targetDate.toLocaleString();
}

// Helper function to format date
export function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
  } catch {
    return "-";
  }
}

// Helper function to get MIME type name
export function getMimeTypeName(mimeType?: string): string {
  if (!mimeType) return "-";
  const parts = mimeType.split("/");
  return parts.length > 1 ? parts[1] : parts[0];
}
