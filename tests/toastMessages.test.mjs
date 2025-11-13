import assert from "node:assert/strict";
import test from "node:test";
import { TOAST_MESSAGES } from "../src/constants/toastMessages.mjs";

test("dataset added toast message matches expected copy", () => {
  assert.equal(
    TOAST_MESSAGES.datasetAddedToCollection.message,
    "Dataset added successfully to the collection!",
  );
});

test("dataset added toast message type is success", () => {
  assert.equal(TOAST_MESSAGES.datasetAddedToCollection.type, "success");
});
