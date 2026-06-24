import assert from "node:assert/strict";
import test from "node:test";
import { FEATURE_FLAGS } from "../src/config/featureFlags";
import { normalizeDeploymentEnv } from "../src/lib/featureFlags/environment";
import { resolveAllFlags, resolveFlag } from "../src/lib/featureFlags/resolve";
import { parseOverrides } from "../src/lib/featureFlags/storage";

test("resolveFlag returns the environment default when no override is set", () => {
  assert.equal(resolveFlag("datasetPackage", "playground", {}), true);
  assert.equal(resolveFlag("datasetPackage", "staging", {}), false);
  assert.equal(resolveFlag("datasetPackage", "production", {}), false);
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
    resolveFlag("datasetPackage", "staging", { datasetPackage: "yes" }),
    false,
  );
});

test("resolveFlag returns false for an unknown flag id", () => {
  // @ts-expect-error unknown flag id is not part of the registry
  assert.equal(resolveFlag("doesNotExist", "playground", {}), false);
});

test("resolveAllFlags resolves every registered flag", () => {
  const resolved = resolveAllFlags("playground", {});
  for (const def of FEATURE_FLAGS) {
    assert.equal(resolved[def.id], true);
  }
  assert.equal(Object.keys(resolved).length, FEATURE_FLAGS.length);
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
