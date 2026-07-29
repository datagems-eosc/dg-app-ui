import assert from "node:assert/strict";
import test from "node:test";
import { FEATURE_FLAGS } from "../src/config/featureFlags";
import { normalizeDeploymentEnv } from "../src/lib/featureFlags/environment";
import {
  resolveAllFlags,
  resolveDatasetId,
  resolveFlag,
} from "../src/lib/featureFlags/resolve";
import { parseOverrides } from "../src/lib/featureFlags/storage";

const DISABLED_EVERYWHERE = new Set([
  "customCollection",
  "generalChat",
  "notification",
  "pinnedDatasetWeather",
  "pinnedDatasetLanguage",
  "pinnedDatasetMath",
]);
const ENVS = ["playground", "staging", "production"] as const;

test("flags enabled everywhere default to true on every environment", () => {
  for (const env of ENVS) {
    assert.equal(resolveFlag("datasetPackage", env, {}), true);
    assert.equal(resolveFlag("useCaseWeather", env, {}), true);
  }
});

test("customCollection and generalChat default to false on every environment", () => {
  for (const env of ENVS) {
    assert.equal(resolveFlag("customCollection", env, {}), false);
    assert.equal(resolveFlag("generalChat", env, {}), false);
  }
});

test("resolveFlag lets an override win over the environment default", () => {
  assert.equal(
    resolveFlag("datasetPackage", "playground", { datasetPackage: false }),
    false,
  );
  assert.equal(
    resolveFlag("datasetPackage", "staging", { datasetPackage: true }),
    true,
  );
});

test("resolveFlag ignores a non-boolean override value", () => {
  assert.equal(
    // @ts-expect-error guarding against malformed persisted storage
    resolveFlag("customCollection", "staging", { customCollection: "yes" }),
    false,
  );
});

test("resolveFlag returns false for an unknown flag id", () => {
  // @ts-expect-error unknown flag id is not part of the registry
  assert.equal(resolveFlag("doesNotExist", "playground", {}), false);
});

test("resolveAllFlags resolves every registered flag per policy", () => {
  for (const env of ENVS) {
    const resolved = resolveAllFlags(env, {});
    assert.equal(Object.keys(resolved).length, FEATURE_FLAGS.length);
    for (const def of FEATURE_FLAGS) {
      assert.equal(resolved[def.id], !DISABLED_EVERYWHERE.has(def.id));
    }
  }
});

test("normalizeDeploymentEnv accepts the three known targets", () => {
  assert.equal(normalizeDeploymentEnv("playground"), "playground");
  assert.equal(normalizeDeploymentEnv("staging"), "staging");
  assert.equal(normalizeDeploymentEnv("production"), "production");
});

test("normalizeDeploymentEnv is case- and whitespace-insensitive", () => {
  assert.equal(normalizeDeploymentEnv("  Staging "), "staging");
});

test("normalizeDeploymentEnv falls back to production for unknown or empty input", () => {
  assert.equal(normalizeDeploymentEnv(""), "production");
  assert.equal(normalizeDeploymentEnv(undefined), "production");
  assert.equal(normalizeDeploymentEnv("dev"), "production");
});

test("parseOverrides returns an empty object for null or invalid JSON", () => {
  assert.deepEqual(parseOverrides(null), {});
  assert.deepEqual(parseOverrides("{not json"), {});
  assert.deepEqual(parseOverrides("[1,2,3]"), {});
});

test("resolveDatasetId returns env default when no override is set", () => {
  assert.equal(
    resolveDatasetId("pinnedDatasetWeather", "playground", {}),
    "3166e649-54c1-4ebf-904e-de9a46cb1b18",
  );
  assert.equal(
    resolveDatasetId("pinnedDatasetWeather", "production", {}),
    "ecd7c0eb-fbfe-4d61-bfed-df8048f648ed",
  );
});

test("resolveDatasetId lets a string override win over the environment default", () => {
  assert.equal(
    resolveDatasetId("pinnedDatasetWeather", "playground", {
      pinnedDatasetWeather: "custom-id",
    }),
    "custom-id",
  );
});

test("resolveDatasetId returns null for a flag with no defaultDatasetId", () => {
  assert.equal(resolveDatasetId("datasetPackage", "playground", {}), null);
});

test("resolveDatasetId falls back to env default when override is empty string", () => {
  assert.equal(
    resolveDatasetId("pinnedDatasetWeather", "playground", {
      pinnedDatasetWeather: "",
    }),
    "3166e649-54c1-4ebf-904e-de9a46cb1b18",
  );
});

test("parseOverrides keeps only known flag ids with boolean values", () => {
  const raw = JSON.stringify({
    datasetPackage: true,
    expertMode: false,
    unknownFlag: true,
    questionRecommendation: "nope",
  });
  assert.deepEqual(parseOverrides(raw), {
    datasetPackage: true,
    expertMode: false,
  });
});
