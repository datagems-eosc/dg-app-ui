"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isClassifiableQuery } from "@/lib/intentRouting/gateway";
import { routeClassification } from "@/lib/intentRouting/routing";
import type {
  ClassificationFailureKind,
  ClassificationOutcome,
  DestinationIntent,
  IntentHandoff,
} from "@/lib/intentRouting/types";

export type HomeQueryState =
  | { status: "idle"; text: string }
  | { status: "classifying"; text: string }
  | { status: "navigating"; text: string }
  | { status: "clarify"; text: string; degraded: boolean }
  | { status: "outOfScope"; text: string }
  | {
      status: "failed";
      text: string;
      kind: Exclude<ClassificationFailureKind, "aborted">;
    };

interface Options {
  classify: (
    query: string,
    options: { signal: AbortSignal },
  ) => Promise<ClassificationOutcome>;
  onNavigate: (handoff: IntentHandoff) => void;
}

/**
 * Home query state machine: one classification per explicit submission.
 *
 * Every submission gets a generation number and an AbortController. A result
 * only applies if its generation is still current, so editing, cancelling or
 * unmounting while a request is pending discards the late reply. The submitted
 * text and the retrieval query are kept so a user choice continues without a
 * second classification.
 */
export function useHomeQuery({ classify, onNavigate }: Options) {
  const [state, setState] = useState<HomeQueryState>({
    status: "idle",
    text: "",
  });
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const submitted = useRef<{ query: string; retrievalQuery: string | null }>({
    query: "",
    retrievalQuery: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const invalidate = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    inFlight.current = false;
  }, []);

  useEffect(() => invalidate, [invalidate]);

  const setText = useCallback(
    (text: string) => {
      if (stateRef.current.status !== "idle") invalidate();
      setState({ status: "idle", text });
    },
    [invalidate],
  );

  const navigate = useCallback(
    (intent: DestinationIntent, chosenBy: IntentHandoff["chosenBy"]) => {
      setState({ status: "navigating", text: submitted.current.query });
      onNavigate({
        originalQuery: submitted.current.query,
        retrievalQuery: submitted.current.retrievalQuery,
        intent,
        chosenBy,
      });
    },
    [onNavigate],
  );

  const submit = useCallback(async () => {
    const text = stateRef.current.text;
    if (inFlight.current || !isClassifiableQuery(text)) return;

    invalidate();
    inFlight.current = true;
    const current = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const query = text.trim();
    submitted.current = { query, retrievalQuery: null };
    setState({ status: "classifying", text });

    const outcome = await classify(query, { signal: abort.signal });
    if (current !== generation.current) return;
    inFlight.current = false;
    controller.current = null;

    if (!outcome.ok) {
      if (outcome.kind === "aborted") return;
      setState({ status: "failed", text, kind: outcome.kind });
      return;
    }

    submitted.current.retrievalQuery = outcome.classification.retrievalQuery;
    const route = routeClassification(outcome.classification);
    if (route.kind === "navigate") navigate(route.intent, "classifier");
    else if (route.kind === "clarify")
      setState({ status: "clarify", text, degraded: route.degraded });
    else setState({ status: "outOfScope", text });
  }, [classify, invalidate, navigate]);

  const cancel = useCallback(() => {
    invalidate();
    setState({ status: "idle", text: stateRef.current.text });
  }, [invalidate]);

  const choose = useCallback(
    (intent: DestinationIntent) => {
      const { status } = stateRef.current;
      if (
        status === "clarify" ||
        status === "outOfScope" ||
        status === "failed"
      )
        navigate(intent, "user");
    },
    [navigate],
  );

  return { state, setText, submit, cancel, choose, retry: submit };
}
