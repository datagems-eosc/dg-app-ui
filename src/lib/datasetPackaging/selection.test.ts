import { expect, it } from "vitest";
import { ids, recommendation } from "./fixtures/recommendation";
import {
  emptySelection,
  reduceSelection,
  selectedDatasetIds,
} from "./selection";

const group = { ...recommendation.packages[0], key: "2:0" };
const manual = () =>
  reduceSelection(emptySelection(2), { type: "toggle-manual", id: ids[0] });
const selected = () =>
  reduceSelection(manual(), { type: "toggle-package", group });

it("opens the drawer and preserves independent contributors after package removal", () => {
  const both = selected();
  expect(both.drawerOpen).toBe(true);
  expect(selectedDatasetIds(both)).toEqual(ids.slice(0, 3));
  expect(
    selectedDatasetIds(
      reduceSelection(both, { type: "toggle-package", group }),
    ),
  ).toEqual([ids[0]]);
  expect(
    selectedDatasetIds(
      reduceSelection(both, { type: "toggle-manual", id: ids[0] }),
    ),
  ).toEqual(ids.slice(0, 3));
});

it("clears all contributors and closes the drawer", () => {
  expect(reduceSelection(selected(), { type: "clear-all" })).toEqual(
    emptySelection(2),
  );
});
it("retains only reauthorized manual choices after context change and none after account change", () => {
  const before = reduceSelection(selected(), {
    type: "toggle-manual",
    id: ids[4],
  });
  const after = reduceSelection(before, {
    type: "replace-context",
    generation: 3,
    authorizedManualIds: [ids[4]],
  });
  expect(selectedDatasetIds(after)).toEqual([ids[4]]);
  expect(reduceSelection(after, { type: "toggle-package", group })).toBe(after);
  expect(
    reduceSelection(after, { type: "reset-account", generation: 4 }),
  ).toEqual(emptySelection(4));
  expect(selectedDatasetIds(before)).toEqual([ids[0], ids[4], ids[1], ids[2]]);
});
it("ignores empty groups and preserves a second contributor even for overlapping local groups", () => {
  const initial = emptySelection(2);
  expect(
    reduceSelection(initial, {
      type: "toggle-package",
      group: { ...group, datasets: [] },
    }),
  ).toBe(initial);
  const shared = { ...group, key: "2:1", datasets: group.datasets.slice(2) };
  const both = reduceSelection(selected(), {
    type: "toggle-package",
    group: shared,
  });
  expect(
    selectedDatasetIds(
      reduceSelection(both, { type: "toggle-package", group }),
    ),
  ).toEqual([ids[0], ids[2]]);
});
