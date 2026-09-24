/**
 * No-network checks of the journey's request boundary. The real route handler
 * is called with fake Playwright routes; nothing is sent anywhere.
 *
 * Run with `node --test tests/browser/dataset-permissions/boundaries.test.mjs`
 * (part of `pnpm run test:browser:dataset-permissions`).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_A, DATASET, GATEWAY } from "./fixtures.mjs";
import { createRouteHandler, createWorld, loopbackOrigin } from "./harness.mjs";

const APP = "http://127.0.0.1:3317";

const fakeRoute = (url, method = "GET") => {
  const calls = [];
  return {
    calls,
    request: () => ({
      url: () => url,
      method: () => method,
      headers: () => ({}),
      postData: () => null,
    }),
    continue: async () => calls.push("continue"),
    abort: async () => calls.push("abort"),
    fulfill: async (response) =>
      calls.push(`fulfill ${response.status ?? 200}`),
  };
};

const send = async (url, base = APP) => {
  const world = createWorld({
    account: ACCOUNT_A,
    datasetId: DATASET.id,
    datasetName: DATASET.name,
  });
  const route = fakeRoute(url);
  await createRouteHandler(world, base)(route);
  return { calls: route.calls, world };
};

describe("local application origin", () => {
  it("allows the exact expected origin", async () => {
    const { calls, world } = await send(`${APP}/datasets/x`);
    assert.deepEqual(calls, ["continue"]);
    assert.deepEqual(world.escaped, []);
  });

  it("rejects a lookalike hostname", async () => {
    const url = "http://127.0.0.1.evil.invalid:3317/probe";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects a lookalike of a localhost base", async () => {
    const url = "http://localhost.evil.invalid/probe";
    const { calls, world } = await send(url, "http://localhost");
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects a different port", async () => {
    const url = "http://127.0.0.1:9999/probe";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects the default port when the base names another", async () => {
    const url = "http://localhost/probe";
    const { calls } = await send(url, "http://localhost:3317");
    assert.deepEqual(calls, ["abort"]);
  });
});

describe("synthetic Gateway origin", () => {
  it("answers the exact expected origin from the stub", async () => {
    const { calls, world } = await send(
      `${GATEWAY}/gw/api/principal/me?f=permissions`,
    );
    assert.deepEqual(calls, ["fulfill 200"]);
    assert.equal(world.ledger[0].kind, "capability-read");
    assert.deepEqual(world.escaped, []);
  });

  it("rejects a lookalike hostname", async () => {
    const url =
      "https://gateway.synthetic.invalid.evil.test/gw/api/principal/me";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
    assert.deepEqual(world.ledger, []);
  });

  it("rejects a different port", async () => {
    const url = "https://gateway.synthetic.invalid:8443/gw/api/principal/me";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("records an unknown Gateway route as unexpected", async () => {
    const { calls, world } = await send(`${GATEWAY}/gw/api/not/a/route`);
    assert.deepEqual(calls, ["fulfill 501"]);
    assert.deepEqual(world.unexpected, ["GET /not/a/route"]);
  });
});

describe("loopback base", () => {
  it("normalizes a trailing slash to the origin", () => {
    assert.equal(
      loopbackOrigin("http://127.0.0.1:3400/"),
      "http://127.0.0.1:3400",
    );
  });

  for (const base of [
    "http://127.0.0.1.evil.invalid:3317",
    "https://127.0.0.1:3317",
    "http://127.0.0.1:3317/app",
    "http://user@127.0.0.1:3317",
  ]) {
    it(`refuses ${base}`, () => {
      assert.throws(() => loopbackOrigin(base));
    });
  }
});
