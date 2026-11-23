/** Which part of a chat request the user is waiting for. */
export type ChatWorkingStep = "discovery" | "in-dataset";

/** Status texts shown while a chat answer is pending. */
export const CHAT_WORKING_MESSAGES: Record<
  ChatWorkingStep,
  readonly [string, ...string[]]
> = {
  discovery: [
    "Looking for datasets that can answer this",
    "Checking which datasets match your question",
  ],
  "in-dataset": [
    "Reading the selected datasets",
    "Running the analysis",
    "Preparing the answer",
    "Still working on the answer",
  ],
};

/**
 * Discovery texts loop; in-dataset texts read as steps in order, so they stop on
 * the last one instead of appearing to start over on a long answer.
 */
export const CHAT_WORKING_REPEAT: Record<ChatWorkingStep, boolean> = {
  discovery: true,
  "in-dataset": false,
};
