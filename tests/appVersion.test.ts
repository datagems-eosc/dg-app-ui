import assert from "node:assert/strict";
import test from "node:test";
import { getAppVersion } from "../src/lib/appVersion";

const restoreVersion = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    return;
  }

  process.env.NEXT_PUBLIC_APP_VERSION = value;
};

test("getAppVersion - returns env version", () => {
  const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION;

  process.env.NEXT_PUBLIC_APP_VERSION = "1.2.3";

  assert.equal(getAppVersion(), "1.2.3");

  restoreVersion(originalVersion);
});

test("getAppVersion - returns empty when missing", () => {
  const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION;

  delete process.env.NEXT_PUBLIC_APP_VERSION;

  assert.equal(getAppVersion(), "");

  restoreVersion(originalVersion);
});
