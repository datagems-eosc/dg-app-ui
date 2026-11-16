import { useCallback, useEffect, useRef, useState } from "react";
import { handoffStore } from "@/lib/intentRouting/handoffStore";
import { getNavigationUrl } from "@/lib/utils";

/**
 * A Home handoff (`?handoff=<id>`, UI #352) opens Datasets with one Smart
 * Search: the box shows the user's original text while discovery uses the
 * classifier's retrieval query. `peek` is pure, so it is read in a state
 * initialiser; the handoff is consumed in an effect and never replayed.
 */
export function useBrowseHandoff(
  handoffId: string | null,
  pathname: string,
  router: { replace: (href: string) => void },
) {
  const [handoff] = useState(() => {
    const pending = handoffId ? handoffStore.peek(handoffId) : null;
    return pending?.intent === "dataset_search" ? pending : null;
  });
  const override = useRef(
    handoff
      ? {
          display: handoff.originalQuery,
          query: handoff.retrievalQuery ?? handoff.originalQuery,
        }
      : null,
  );
  useEffect(() => {
    if (!handoffId) return;
    handoffStore.consume(handoffId);
    router.replace(getNavigationUrl(pathname));
  }, [handoffId, pathname, router]);

  /**
   * The query Smart Search sends for `term`: the retrieval query while the box
   * still shows the handed-off text. Any other text ends the override for
   * good, so call it only from the effect that starts the search.
   */
  const smartQueryFor = useCallback((term: string) => {
    const current = override.current;
    if (!current) return term;
    if (term === current.display) return current.query;
    override.current = null;
    return term;
  }, []);

  return {
    initialText: handoff?.originalQuery ?? "",
    startsSmart: handoff !== null,
    smartQueryFor,
  };
}
