/**
 * Language pilot — fixtures shaped like the Gateway model
 * (`dg-app-api` `Model/LanguagePilot.cs`, `CorpusAnalysisResponse.cs`,
 * `SearchResult.cs`). Values follow one dev response inspected on 10 November:
 * `count` carries occurrences, `frequency` is `count` over the chunk total.
 */

export const DATASET_ID = "5f0c1d2e-0000-4000-8000-000000000001";
export const PASSAGE_OBJECT_ID = "5f0c1d2e-0000-4000-8000-0000000000a1";
export const CONVERSATION_ID = "5f0c1d2e-0000-4000-8000-0000000000c1";

export const analysisPayload = {
  rag_output: {
    query_time: 1.2,
    results: [
      {
        content: "Vienna lies on the Danube.",
        dataset_id: DATASET_ID,
        object_id: PASSAGE_OBJECT_ID,
        similarity: 0.71,
        metadata: { source: "chunk-1" },
      },
      {
        content: "The old town of Vienna is a heritage site.",
        dataset_id: DATASET_ID,
        object_id: "5f0c1d2e-0000-4000-8000-0000000000a2",
        similarity: 0.88,
        metadata: {},
      },
    ],
  },
  features: [
    {
      dataset_id: DATASET_ID,
      object_id: "chunk-1",
      similarity: 0.71,
      term_frequency: [
        { term: "vienna", frequency: 0.052632, count: 3 },
        { term: "danube", frequency: 0.035088, count: 2 },
      ],
      sentiment_profile: {
        label: "neutral",
        positive_terms: 2,
        negative_terms: 1,
        neutral_terms: 7,
        total_terms: 10,
        polarity_score: 0.2,
        subjectivity_score: 0.4,
      },
      collocations: [
        { terms: ["old", "town"], count: 2, association_score: 4.5 },
      ],
    },
    {
      dataset_id: DATASET_ID,
      object_id: "chunk-2",
      similarity: 0.88,
      term_frequency: [{ term: "vienna", frequency: 0.017544, count: 1 }],
      sentiment_profile: {
        label: "positive",
        positive_terms: 3,
        negative_terms: 0,
        neutral_terms: 7,
        total_terms: 10,
        polarity_score: 0.6,
        subjectivity_score: 0.2,
      },
      collocations: [
        { terms: ["old", "town"], count: 1, association_score: 5.1 },
        { terms: ["heritage", "site"], count: 1, association_score: 3.2 },
      ],
    },
  ],
  used_chunks: [
    { dataset_id: DATASET_ID, object_id: "chunk-1", similarity: 0.71 },
  ],
};

/** Current Gateway: `SearchResult<LanguagePilotResponse>`. */
export const envelopedWithData = {
  result: analysisPayload,
  conversationId: CONVERSATION_ID,
};

/** Older Gateway, or a result stored in the tab before the envelope fix. */
export const bareWithData = analysisPayload;

export const envelopedEmpty = {
  result: {
    rag_output: { query_time: 0.4, results: [] },
    features: [],
    used_chunks: [],
  },
  conversationId: null,
};

/** The Gateway model has no defaults, so absent service fields serialize as `null`. */
export const envelopedNullFields = {
  result: { rag_output: null, features: null, used_chunks: null },
  conversationId: null,
};

export const passagesWithoutFeatures = {
  result: {
    rag_output: analysisPayload.rag_output,
    features: [],
    used_chunks: [],
  },
  conversationId: null,
};

/** A different envelope: recognizable keys are missing. */
export const unrecognizedEnvelope = {
  items: [{ text: "Vienna lies on the Danube." }],
  count: 1,
};

export const wrongTypeFeatures = {
  result: { rag_output: null, features: "Vienna lies on the Danube." },
  conversationId: null,
};
