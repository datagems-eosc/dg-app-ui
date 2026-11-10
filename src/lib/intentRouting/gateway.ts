/**
 * Home intent routing — Gateway adapter.
 *
 * Transport is injected with the same signature as `makeRequest` in
 * `src/hooks/useApi.ts`, which adds the bearer token and the `/gw/api` prefix.
 * One call per invocation: no retry, no cache. The classifier only classifies;
 * it does not search or analyse, and this request never creates a conversation
 * (`UpdateConversation` returns early without an id or auto-create).
 *
 * Contract source: Gateway `SearchController.DisambiguateIntentAsync` at
 * `68195367639f27b2d987955e758d28ad67acbade` (source-read, not observed live).
 * Query length 1–2000 mirrors `IntentDisambiguationRequest.Validator`.
 */

import { decodeClassification } from "./decode";
import type { ClassificationOutcome } from "./types";

export const MAX_QUERY_LENGTH = 2000;

const PROJECTION = [
  "intent",
  "confidence",
  "searchQuery",
  "degraded",
  "model",
  "promptVersion",
];

export const CLASSIFY_PATH = `/search/disambiguate-intent?${PROJECTION.map(
  (field) => `f=${field}`,
).join("&")}`;

export type IntentRequest = (
  path: string,
  init: RequestInit,
) => Promise<Response>;

export function isClassifiableQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_QUERY_LENGTH;
}

function statusKind(status: number): "auth" | "unavailable" | "http" {
  if (status === 401 || status === 403) return "auth";
  if (status === 503) return "unavailable";
  return "http";
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export async function classifyIntent(
  request: IntentRequest,
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<ClassificationOutcome> {
  if (!isClassifiableQuery(query)) return { ok: false, kind: "invalid" };

  let response: Response;
  try {
    response = await request(CLASSIFY_PATH, {
      method: "POST",
      body: JSON.stringify({
        query: query.trim(),
        conversationOptions: { autoCreateConversation: false },
      }),
      signal: options.signal,
    });
  } catch (error) {
    return { ok: false, kind: isAbort(error) ? "aborted" : "network" };
  }

  if (!response.ok) return { ok: false, kind: statusKind(response.status) };

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return { ok: false, kind: isAbort(error) ? "aborted" : "invalid" };
  }

  const decoded = decodeClassification(body);
  return decoded.ok
    ? { ok: true, classification: decoded.value }
    : { ok: false, kind: "invalid" };
}
