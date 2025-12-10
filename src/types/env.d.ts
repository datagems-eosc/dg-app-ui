/**
 * Type declarations for dynamic environment variables system.
 * window.__env is populated by env.sh at container startup.
 */

interface Window {
  /**
   * Runtime environment variables injected by env.sh.
   * Contains PUBLIC_* variables exposed to the client.
   */
  __env?: Record<string, string>;
}
