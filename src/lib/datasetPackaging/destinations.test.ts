import { expect, it } from "vitest";
import { packageDestinations } from "./destinations";
import { ids, recommendation } from "./fixtures/recommendation";
import { emptySelection, reduceSelection } from "./selection";

it("derives exact dataset IDs without enabling either destination", () => {
  const initial = emptySelection(5);
  const manual = reduceSelection(initial, {
    type: "toggle-manual",
    id: ids[0],
  });
  const selected = reduceSelection(manual, {
    type: "toggle-package",
    group: { ...recommendation.packages[0], key: "5:0" },
  });
  expect(packageDestinations(initial)).toEqual({
    datasetIds: [],
    chatAvailable: false,
    collectionAvailable: false,
  });
  expect(packageDestinations(selected)).toEqual({
    datasetIds: ids.slice(0, 3),
    chatAvailable: false,
    collectionAvailable: false,
  });
});
