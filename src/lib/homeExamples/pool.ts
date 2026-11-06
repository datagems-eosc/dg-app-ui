/**
 * Home example queries — curated pool.
 *
 * Placeholder content until the partner's pool of questions tied to public
 * datasets arrives (6 November UI call). Every entry was classified on dev on
 * 6 November with the expected intent (confidence ≥ 0.95); re-run the
 * classifier evaluation before replacing or extending the list, and keep only
 * queries that route straight to Browse or Chat.
 */
import type { DestinationIntent } from "@/lib/intentRouting/types";

export interface ExampleQuery {
  text: string;
  intent: DestinationIntent;
}

export const HOME_EXAMPLE_COUNTS = { idle: 4, outOfScope: 3 } as const;

export const EXAMPLE_POOL: readonly ExampleQuery[] = [
  {
    text: "datasets about air temperature in Greece",
    intent: "dataset_search",
  },
  { text: "find datasets on rainfall in Crete", intent: "dataset_search" },
  { text: "Greek language corpora", intent: "dataset_search" },
  {
    text: "datasets of lifelong learning course enrolments",
    intent: "dataset_search",
  },
  {
    text: "open educational resources about algebra",
    intent: "dataset_search",
  },
  {
    text: "find a corpus of Greek parliamentary speeches",
    intent: "dataset_search",
  },
  {
    text: "What was the average air temperature in Athens in July 2024?",
    intent: "question",
  },
  {
    text: "Which month had the highest rainfall in Crete in 2023?",
    intent: "question",
  },
  {
    text: "How many adults participated in lifelong learning in Greece in 2022?",
    intent: "question",
  },
  {
    text: "What are the most frequent words in Greek parliamentary speeches from 2020?",
    intent: "question",
  },
  {
    text: "Compare average temperatures in Athens and Thessaloniki in summer 2023",
    intent: "question",
  },
  {
    text: "What was the wettest day in Athens in 2023 and how much rain fell?",
    intent: "question",
  },
];
