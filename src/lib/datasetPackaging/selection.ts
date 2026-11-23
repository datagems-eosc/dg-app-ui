import type { PackageView } from "./types";

export interface Selection {
  generation: number;
  manualIds: ReadonlySet<string>;
  packages: ReadonlyMap<string, PackageView>;
  drawerOpen: boolean;
}
export function emptySelection(generation: number): Selection {
  return {
    generation,
    manualIds: new Set(),
    packages: new Map(),
    drawerOpen: false,
  };
}

type SelectionAction =
  | { type: "clear-all" }
  | {
      type: "replace-context";
      generation: number;
      authorizedManualIds: readonly string[];
    }
  | { type: "reset-account"; generation: number }
  | { type: "toggle-manual"; id: string }
  | { type: "toggle-package"; group: PackageView };

export function reduceSelection(
  state: Selection,
  action: SelectionAction,
): Selection {
  switch (action.type) {
    case "clear-all":
      return emptySelection(state.generation);
    case "reset-account":
      return emptySelection(action.generation);
    case "replace-context": {
      const allowed = new Set(
        action.authorizedManualIds.map((id) => id.toLowerCase()),
      );
      const manualIds = new Set(
        [...state.manualIds].filter((id) => allowed.has(id)),
      );
      return {
        ...emptySelection(action.generation),
        manualIds,
        drawerOpen: manualIds.size > 0,
      };
    }
    case "toggle-manual": {
      const manualIds = new Set(state.manualIds);
      const id = action.id.toLowerCase();
      if (!manualIds.delete(id)) manualIds.add(id);
      return {
        ...state,
        manualIds,
        drawerOpen: manualIds.size > 0 || state.packages.size > 0,
      };
    }
    case "toggle-package": {
      const { group } = action;
      if (
        !group.datasets.length ||
        !group.key.startsWith(`${state.generation}:`)
      )
        return state;
      const packages = new Map(state.packages);
      if (!packages.delete(group.key)) packages.set(group.key, group);
      return {
        ...state,
        packages,
        drawerOpen: packages.size > 0 || state.manualIds.size > 0,
      };
    }
  }
}

export function selectedDatasetIds(state: Selection): string[] {
  const ids = new Set(state.manualIds);
  for (const group of state.packages.values()) {
    for (const dataset of group.datasets) ids.add(dataset.id);
  }
  return [...ids];
}
