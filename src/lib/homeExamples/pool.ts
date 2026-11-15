/**
 * Home example queries — curated pool.
 *
 * Source: the partner's question pool of 13 November (questions tied to
 * public datasets, used as one pool). Every entry was classified again on dev
 * on 15 November and `intent` is the classifier's result (confidence ≥ 0.95);
 * each target dataset was visible to a regular dev account that day. Re-run
 * the classifier evaluation before replacing or extending the list, and keep
 * only queries that route straight to Datasets or Chat.
 */
import type { DestinationIntent } from "@/lib/intentRouting/types";

export interface ExampleQuery {
  text: string;
  intent: DestinationIntent;
}

export const HOME_EXAMPLE_COUNTS = { idle: 4, outOfScope: 3 } as const;

/** Datasets shows dataset searches only, when Smart search is on and the box is empty. */
export const DATASETS_EXAMPLE_COUNT = 4;

export const EXAMPLE_POOL: readonly ExampleQuery[] = [
  {
    text: "datasets of 18th century French encyclopedia entries",
    intent: "dataset_search",
  },
  {
    text: "transcriptions of the Encyclopaedia Britannica",
    intent: "dataset_search",
  },
  {
    text: "Wikipedia articles linked to historical encyclopedia entries",
    intent: "dataset_search",
  },
  {
    text: "database of an online mathematics learning platform",
    intent: "dataset_search",
  },
  {
    text: "real-time weather measurements from the National Observatory of Athens",
    intent: "dataset_search",
  },
  {
    text: "hospital readmission records of diabetic patients",
    intent: "dataset_search",
  },
  {
    text: "datasets on school enrolment and literacy worldwide",
    intent: "dataset_search",
  },
  {
    text: "datasets of monthly surface temperature by country",
    intent: "dataset_search",
  },
  {
    text: "datasets about forest fires in Portugal",
    intent: "dataset_search",
  },
  {
    text: "datasets of solar photovoltaic production in Europe",
    intent: "dataset_search",
  },
  {
    text: "find datasets on unemployment in the European Union",
    intent: "dataset_search",
  },
  {
    text: "datasets of global energy statistics",
    intent: "dataset_search",
  },
  {
    text: "How does Diderot's Encyclopédie define the word 'liberté'?",
    intent: "question",
  },
  {
    text: "What does the 9th edition of the Encyclopaedia Britannica say about the steam engine?",
    intent: "question",
  },
  {
    text: "What does Wikipedia say about the history of Dresden?",
    intent: "question",
  },
  {
    text: "What skills does a data scientist need according to the skill model?",
    intent: "question",
  },
  {
    text: "How has the gender gap in education changed in low-income countries?",
    intent: "question",
  },
  {
    text: "What is the average wind speed across NOA weather stations?",
    intent: "question",
  },
  {
    text: "How much has the average surface temperature in Greece risen since 1940?",
    intent: "question",
  },
  {
    text: "Which month has the largest burned area in the Portuguese forest fires data?",
    intent: "question",
  },
  {
    text: "Which European country has the highest average photovoltaic capacity factor?",
    intent: "question",
  },
  {
    text: "What was the youth unemployment rate in Greece in 2013?",
    intent: "question",
  },
  {
    text: "How does age relate to early readmission of diabetic patients?",
    intent: "question",
  },
];
