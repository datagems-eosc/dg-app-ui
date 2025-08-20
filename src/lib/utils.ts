import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to handle base path in URLs
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
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
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT token:", error);
    return null;
  }
}

/**
 * Extracts user information from JWT token
 */
export function getUserFromToken(
  token: string
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
  return (
    process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL ||
    "https://datagems-dev.scayle.es"
  );
}

/**
 * Wrapper for fetch that logs out the user (redirects to /logout) on 401 Unauthorized.
 * Use this for all authenticated API calls in the browser.
 *
 * @param input - RequestInfo (URL or Request object)
 * @param init - RequestInit (fetch options)
 * @returns Promise<Response>
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 && typeof window !== "undefined") {
    if (window.location.pathname !== getLogoutUrl()) {
      window.location.href = getLogoutUrl();
    }
    // Prevent further code execution
    return new Response(null, { status: 401, statusText: "Unauthorized" });
  }
  return response;
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
  const size = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;

  if (isNaN(size)) return "N/A";

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

  const value = parseFloat(match[1]);
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
  if (isNaN(targetDate.getTime())) {
    return "Invalid date";
  }

  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000
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
    if (isNaN(date.getTime())) return "-";
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
