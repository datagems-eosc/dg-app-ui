/**
 * Dataset permissions — decoding one dataset payload's `permissions` field.
 *
 * The Gateway's `DatasetBuilder` returns the *requested* permission names that
 * are actually assigned, reduced to lower case by
 * `Extensions.ReduceToAssignedPermissions`. That is a `string[]`.
 *
 * The details page previously tested `typeof permissions === "object"` before
 * `Array.isArray`, and arrays are objects, so the array branch was
 * unreachable: a real response mapped to an empty permission list while the
 * page separately labelled the dataset "Open Access". This module decodes the
 * array shape first and keeps the legacy boolean-object shape as explicit
 * compatibility input, because fixtures and older mock data still use it.
 *
 * Matching is by explicit known name. An unrecognised name is preserved as
 * evidence that the contract moved; it never becomes a capability.
 */

import {
  type AbsentReason,
  DATASET_PERMISSION_NAMES,
  type DatasetCapability,
  type DecodedCallerPermissions,
} from "./types";

/**
 * Legacy boolean-object keys accepted per capability, beside the current
 * Gateway name. `downloadDataset` is kept only because existing UI fixtures
 * and mock data use it; it is not a name this Gateway revision declares.
 */
const LEGACY_OBJECT_KEYS: Record<DatasetCapability, readonly string[]> = {
  browse: ["browseDataset"],
  edit: ["editDataset"],
  download: ["downloadDatasetFile", "downloadDataset"],
  delete: ["deleteDataset"],
  search: ["searchDataset"],
  /**
   * No Gateway permission corresponds to this, so it can only ever arrive from
   * the legacy object shape. It is kept so existing display input keeps
   * producing the chip it always produced, and it authorizes nothing.
   */
  manage: ["manageDataset"],
};

const CAPABILITY_ORDER: readonly DatasetCapability[] = [
  "browse",
  "edit",
  "download",
  "manage",
  "delete",
  "search",
];

/** Gateway output is lower-cased; fixtures are not. Compare case-insensitively. */
const canonical = (value: string): string => value.trim().toLowerCase();

/** Only real Gateway permission names can be matched from a permission array. */
const NAME_TO_CAPABILITY = new Map<string, DatasetCapability>(
  (
    Object.keys(
      DATASET_PERMISSION_NAMES,
    ) as (keyof typeof DATASET_PERMISSION_NAMES)[]
  ).map((capability) => [
    canonical(DATASET_PERMISSION_NAMES[capability]),
    capability,
  ]),
);

const OBJECT_KEY_TO_CAPABILITY = new Map<string, DatasetCapability>([
  ...NAME_TO_CAPABILITY,
  ...CAPABILITY_ORDER.flatMap((capability) =>
    LEGACY_OBJECT_KEYS[capability].map(
      (key) => [canonical(key), capability] as const,
    ),
  ),
]);

const absent = (reason: AbsentReason): DecodedCallerPermissions => ({
  kind: "absent",
  reason,
});

/** Stable display order, and each capability at most once. */
const orderCapabilities = (
  found: ReadonlySet<DatasetCapability>,
): readonly DatasetCapability[] =>
  CAPABILITY_ORDER.filter((capability) => found.has(capability));

/**
 * Decode the `permissions` value of a dataset payload.
 *
 * An empty array or object is a complete answer and decodes to `read` with no
 * capabilities. A non-empty value whose entries cannot be interpreted at all
 * decodes to `absent`: the caller must not present a shape it failed to read
 * as proof that the principal has nothing.
 */
export function decodeCallerPermissions(
  permissions: unknown,
): DecodedCallerPermissions {
  if (Array.isArray(permissions)) {
    return decodePermissionArray(permissions);
  }
  if (typeof permissions === "object" && permissions !== null) {
    return decodeLegacyPermissionObject(permissions as Record<string, unknown>);
  }
  return absent("missing");
}

function decodePermissionArray(
  entries: readonly unknown[],
): DecodedCallerPermissions {
  const found = new Set<DatasetCapability>();
  const names: string[] = [];
  const unrecognized: string[] = [];

  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    names.push(entry);
    const capability = NAME_TO_CAPABILITY.get(canonical(entry));
    if (capability) {
      found.add(capability);
    } else {
      unrecognized.push(entry);
    }
  }

  if (entries.length > 0 && names.length === 0) {
    return absent("unreadable");
  }

  return {
    kind: "read",
    source: "array",
    capabilities: orderCapabilities(found),
    names,
    unrecognized,
  };
}

/**
 * Compatibility shape: `{ browseDataset: true, editDataset: false }`, in camel
 * or Pascal case. Truthiness is the historical contract and is preserved, so a
 * fixture that used `1` or `"yes"` keeps displaying what it always displayed.
 * A `false` value is a real negative, not missing evidence.
 */
function decodeLegacyPermissionObject(
  permissions: Record<string, unknown>,
): DecodedCallerPermissions {
  const keys = Object.keys(permissions);
  const found = new Set<DatasetCapability>();
  const names: string[] = [];
  const unrecognized: string[] = [];
  let recognizedKeys = 0;

  for (const key of keys) {
    const capability = OBJECT_KEY_TO_CAPABILITY.get(canonical(key));
    if (capability) {
      recognizedKeys += 1;
    } else {
      unrecognized.push(key);
    }
    // Only a truthy value means the permission is held; `false` is a real
    // negative and must not enter the held-names set.
    if (!permissions[key]) continue;
    names.push(key);
    if (capability) found.add(capability);
  }

  if (keys.length > 0 && recognizedKeys === 0) {
    return absent("unreadable");
  }

  return {
    kind: "read",
    source: "legacy-object",
    capabilities: orderCapabilities(found),
    names,
    unrecognized,
  };
}
