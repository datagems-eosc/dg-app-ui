/**
 * No-network checks of the journey's request boundary. The real route handler
 * is called with fake Playwright routes; nothing is sent anywhere.
 *
 * Run with `node --test tests/browser/dataset-onboarding/boundaries.test.mjs`
 * (part of `pnpm run test:browser:onboarding`).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_A, DATASET_ID, GATEWAY, PROCESS_ID } from "./fixtures.mjs";
import { createRouteHandler, createWorld, loopbackOrigin } from "./harness.mjs";

const APP = "http://127.0.0.1:3118";

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

const send = async (url, { base = APP, method = "GET", world } = {}) => {
  const target = world ?? createWorld({ account: ACCOUNT_A });
  const route = fakeRoute(url, method);
  await createRouteHandler(target, base)(route);
  return { calls: route.calls, world: target };
};

describe("local application origin", () => {
  it("allows the exact expected origin", async () => {
    const { calls, world } = await send(`${APP}/datasets/add`);
    assert.deepEqual(calls, ["continue"]);
    assert.deepEqual(world.escaped, []);
  });

  it("answers the session synthetically, never from the server", async () => {
    const { calls, world } = await send(`${APP}/api/auth/session`);
    assert.deepEqual(calls, ["fulfill 200"]);
    assert.equal(world.ledger[0].kind, "session");
  });

  it("rejects a lookalike hostname", async () => {
    const url = "http://127.0.0.1.evil.invalid:3118/probe";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects a different port", async () => {
    const url = "http://127.0.0.1:3000/probe";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects the default port when the base names another", async () => {
    const { calls } = await send("http://localhost/probe", {
      base: "http://localhost:3118",
    });
    assert.deepEqual(calls, ["abort"]);
  });
});

describe("synthetic Gateway origin", () => {
  it("answers the exact expected origin from the stub", async () => {
    const { calls, world } = await send(
      `${GATEWAY}/gw/api/dataset/${DATASET_ID}?f=id&f=name`,
    );
    assert.deepEqual(calls, ["fulfill 200"]);
    assert.equal(world.ledger[0].kind, "access-read");
    assert.deepEqual(world.escaped, []);
  });

  it("counts a start as a start", async () => {
    const { calls, world } = await send(
      `${GATEWAY}/gw/api/workflow-process/onboard?f=id`,
      { method: "POST" },
    );
    assert.deepEqual(calls, ["fulfill 200"]);
    assert.equal(world.count("start"), 1);
  });

  it("reads the process only with the routine projection", async () => {
    const { world } = await send(
      `${GATEWAY}/gw/api/workflow-process/${PROCESS_ID}?f=id&f=processId&f=status&f=dataset.id&f=steps.id&f=steps.stepId&f=steps.status`,
    );
    assert.equal(world.count("process-read"), 1);
    const other = await send(
      `${GATEWAY}/gw/api/workflow-process/${PROCESS_ID}?f=workflowTaskInstanceDetails`,
    );
    assert.equal(other.world.unexpected.length, 1);
  });

  it("rejects a lookalike hostname", async () => {
    const url = "https://gateway.synthetic.invalid.evil.test/gw/api/dataset/x";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
    assert.deepEqual(world.ledger, []);
  });

  it("rejects a different port", async () => {
    const url = "https://gateway.synthetic.invalid:8443/gw/api/dataset/x";
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("rejects plain http to the Gateway host", async () => {
    const url = "http://gateway.synthetic.invalid/gw/api/dataset/x";
    const { calls } = await send(url);
    assert.deepEqual(calls, ["abort"]);
  });

  it("rejects a Gateway path outside /gw/api", async () => {
    const url = `${GATEWAY}/gw/apix/dataset/x`;
    const { calls, world } = await send(url);
    assert.deepEqual(calls, ["abort"]);
    assert.deepEqual(world.escaped, [url]);
  });

  it("records grants and unknown routes as unexpected", async () => {
    const world = createWorld({ account: ACCOUNT_A });
    const grant = `${GATEWAY}/gw/api/principal/context-grants/user/u/dataset/${DATASET_ID}/role/r`;
    const a = await send(grant, { method: "POST", world });
    const b = await send(`${GATEWAY}/gw/api/not/a/route`, { world });
    assert.deepEqual([...a.calls, ...b.calls], ["fulfill 501", "fulfill 501"]);
    assert.equal(world.unexpected.length, 2);
  });
});

describe("loopback base", () => {
  it("normalizes a trailing slash to the origin", () => {
    assert.equal(
      loopbackOrigin("http://127.0.0.1:3118/"),
      "http://127.0.0.1:3118",
    );
  });

  for (const base of [
    "http://127.0.0.1.evil.invalid:3118",
    "https://127.0.0.1:3118",
    "http://127.0.0.1:3118/app",
    "http://user@127.0.0.1:3118",
    "http://10.0.0.5:3118",
  ]) {
    it(`refuses ${base}`, () => {
      assert.throws(() => loopbackOrigin(base));
    });
  }
});
