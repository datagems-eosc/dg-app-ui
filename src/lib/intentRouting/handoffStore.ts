/**
 * Home intent routing — tab-local, consume-once handoff store.
 *
 * Home creates a handoff and navigates with only its opaque id in the URL
 * (`?handoff=<id>`). The destination reads it with `peek` during render and
 * calls `consume` in the effect that starts its request: only the first
 * `consume` wins, so remounts, StrictMode double effects and Back never start
 * a second submission. The store lives in module memory, so a reload finds
 * nothing and the destination falls back to its direct-entry state. Query text
 * is never written to the URL or to browser storage.
 */

import type { IntentHandoff } from "./types";

export const HANDOFF_TTL_MS = 60_000;

interface Entry {
  handoff: IntentHandoff;
  createdAt: number;
}

interface StoreOptions {
  now?: () => number;
  randomId?: () => string;
}

const defaultRandomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createHandoffStore({
  now = Date.now,
  randomId = defaultRandomId,
}: StoreOptions = {}) {
  const entries = new Map<string, Entry>();

  const live = (id: string): Entry | null => {
    const entry = entries.get(id);
    if (!entry) return null;
    if (now() - entry.createdAt > HANDOFF_TTL_MS) {
      entries.delete(id);
      return null;
    }
    return entry;
  };

  return {
    create(handoff: IntentHandoff): string {
      const id = randomId();
      entries.set(id, { handoff, createdAt: now() });
      return id;
    },
    peek(id: string): IntentHandoff | null {
      return live(id)?.handoff ?? null;
    },
    /** True for the first caller only; later calls and unknown ids get false. */
    consume(id: string): boolean {
      if (!live(id)) return false;
      entries.delete(id);
      return true;
    },
  };
}

export const handoffStore = createHandoffStore();
