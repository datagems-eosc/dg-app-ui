/** Which part of a chat request the user is waiting for. */
export type ChatWorkingStep = "discovery" | "in-dataset";

/** Status texts shown in a loop while a chat answer is pending. */
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
  ],
};
