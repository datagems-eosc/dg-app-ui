/**
 * Harness for the dataset onboarding browser journey.
 *
 * - The application server is the real Next.js dev server, bound to 127.0.0.1
 *   and owned by this run (or an already-running loopback server you name).
 * - Every request leaving the page is routed here. Loopback requests reach the
 *   app, except `/__env.js` and `/api/auth/*`, which are synthetic. Requests to
 *   the synthetic Gateway are answered by a strict stub: an unknown Gateway
 *   route is recorded as unexpected and fails the run. Anything addressed to
 *   any other origin is aborted and recorded as escaped, and also fails.
 * - No real credential, upload, dataset or process is involved.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { connect, createServer } from "node:net";
import path from "node:path";
import {
  CONFIG,
  DATASET_ID,
  DATASET_NAME,
  FIELDS_OF_SCIENCE,
  GATEWAY,
  LICENSES,
  PROCESS_ID,
  RUNNING,
  STAGED,
} from "./fixtures.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The exact origin of a loopback `http` base URL, e.g. `http://127.0.0.1:3118`.
 * Anything else is refused. Paths, credentials, queries and fragments are not
 * part of a base and are refused too, so the origin is the whole target.
 */
export function loopbackOrigin(baseUrl) {
  const url = new URL(baseUrl);
  if (
    url.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      `Refusing target ${baseUrl}: use a bare loopback origin such as http://127.0.0.1:<port>.`,
    );
  }
  return url.origin;
}

const GATEWAY_ORIGIN = new URL(GATEWAY).origin;
const GATEWAY_PREFIX = "/gw/api";

/**
 * Where a request is going, decided on its parsed origin, never on a string
 * prefix. `app` and `gateway` carry the path and query to classify further.
 */
export function classifyRequest(rawUrl, appOrigin) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { target: "escaped" };
  }
  if (url.protocol === "data:" || url.protocol === "blob:") {
    return { target: "inline" };
  }
  const local = `${url.pathname}${url.search}`;
  if (url.origin === appOrigin) return { target: "app", local };
  if (
    url.origin === GATEWAY_ORIGIN &&
    url.pathname.startsWith(`${GATEWAY_PREFIX}/`)
  ) {
    return { target: "gateway", local: local.slice(GATEWAY_PREFIX.length) };
  }
  return { target: "escaped" };
}

/** Whether something already accepts connections there. */
const answers = (port, host) =>
  new Promise((resolve) => {
    const socket = connect({ port, host });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

/**
 * A bind probe alone is not enough: on macOS a loopback bind can succeed while
 * another process listens on the wildcard address, so anything that already
 * answers is treated as busy before binding is tried.
 */
const portIsFree = async (port) => {
  if ((await answers(port, "127.0.0.1")) || (await answers(port, "::1"))) {
    return false;
  }
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
};

/**
 * Starts `next dev` on 127.0.0.1:<port>; never touches a server it did not
 * start. `stop` is safe to call at any point, including after a failed start.
 */
export async function startServer({ appRoot, port, logFile }) {
  if (!(await portIsFree(port))) {
    throw new Error(
      `Port ${port} is already in use. Choose another with DG_BROWSER_PORT; this run never stops a server it did not start.`,
    );
  }
  const log = createWriteStream(logFile);
  const child = spawn(
    path.join(appRoot, "node_modules", ".bin", "next"),
    ["dev", "--turbopack", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: appRoot,
      detached: true,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const exited = new Promise((resolve) => child.once("exit", resolve));

  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    const timeout = new Promise((resolve) => setTimeout(resolve, 5000, "t"));
    if ((await Promise.race([exited, timeout])) === "t") {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
  };

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  try {
    for (;;) {
      if (child.exitCode !== null) {
        throw new Error(`next dev exited early; see ${logFile}`);
      }
      try {
        const response = await fetch(`${baseUrl}/healthz`);
        if (response.ok) break;
      } catch {}
      if (Date.now() > deadline) {
        throw new Error(`next dev did not become ready; see ${logFile}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    await stop();
    throw error;
  }
  return { baseUrl, stop };
}

// ---------------------------------------------------------------------------
// Synthetic world and strict Gateway stub
// ---------------------------------------------------------------------------

const json = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/**
 * Mutable synthetic state for one browser context.
 *
 * - `upload`: `ok` (staged path) or `fail` (500).
 * - `start`: `ok` (the process id), `lose` (the connection drops after
 *   dispatch, so the outcome is unknown), `refuse` (400, a definite refusal)
 *   or `forbid` (403, insufficient rights with an uncertain creation outcome).
 * - `process`: the snapshot process reads return. `access`: the dataset read's
 *   status. `hold` names request kinds (`upload`, `process`, `access`) to
 *   keep open until {@link World.release}; the answer is decided on release.
 */
export function createWorld(options) {
  const world = {
    account: options.account,
    flags: { datasetOnboarding: true, datasetOnboardingMonitoring: true },
    upload: "ok",
    start: "ok",
    process: RUNNING,
    access: 200,
    hold: new Set(),
    ...options,
    ledger: [],
    unexpected: [],
    escaped: [],
    held: [],
    release(kind) {
      const pending = world.held.filter((entry) => entry.kind === kind);
      world.held = world.held.filter((entry) => entry.kind !== kind);
      for (const entry of pending) entry.resolve();
      return pending.length;
    },
    mark() {
      return world.ledger.length;
    },
    since(mark, kind) {
      return world.ledger
        .slice(mark)
        .filter((entry) => kind === undefined || entry.kind === kind);
    },
    count(kind) {
      return world.since(0, kind).length;
    },
  };
  return world;
}

const ENV_BODY = (baseUrl) =>
  `window.__env=${JSON.stringify({
    BASE_PATH: "",
    APP_NAME: "DataGEMS",
    DATAGEMS_API_BASE_URL: GATEWAY,
    APP_BASE_URL: baseUrl,
    DEPLOYMENT_ENV: "playground",
  })};`;

const PROCESS_READ = new RegExp(
  `^/workflow-process/${PROCESS_ID}\\?f=id&f=processId&f=status&f=dataset\\.id&f=steps\\.id&f=steps\\.stepId&f=steps\\.status$`,
);
const ACCESS_READ = new RegExp(`^/dataset/${DATASET_ID}\\?f=id&f=name$`);

/**
 * Shell reads the dashboard layout makes on every page. The list endpoints are
 * `POST …/query`: reads with a body, named here rather than silently folded
 * into "no writes".
 */
const SHELL_POST_QUERIES = new Set([
  "/collection/query",
  "/conversation/me/query",
  "/dataset/query",
]);
const SHELL_GET_PREFIXES = ["/user/settings/favorites/dataset?"];

/** Held until released; the answer is decided at release time. */
const holdable = (world, kind, route, answer) =>
  world.hold.has(kind)
    ? new Promise((resolve) => {
        world.held.push({ kind, resolve: () => resolve(answer()) });
      })
    : answer();

async function answerGateway(route, world, pathname) {
  const request = route.request();
  const method = request.method();
  const entry = {
    method,
    path: pathname,
    auth: request.headers().authorization ?? null,
    kind: "background",
  };
  world.ledger.push(entry);

  if (method === "POST" && pathname.startsWith("/storage/upload/dataset")) {
    entry.kind = "upload";
    return holdable(world, "upload", route, () =>
      world.upload === "fail"
        ? route.fulfill(json({ error: "disk full on node-7" }, 500))
        : route.fulfill(json([STAGED])),
    );
  }
  if (method === "POST" && pathname === "/workflow-process/onboard?f=id") {
    entry.kind = "start";
    switch (world.start) {
      case "lose":
        return route.abort("connectionreset");
      case "refuse":
        return route.fulfill(json({ error: "validation" }, 400));
      case "forbid":
        return route.fulfill(
          json({ code: 101, error: "insufficient rights" }, 403),
        );
      default:
        return route.fulfill(json({ id: PROCESS_ID }));
    }
  }
  if (method === "GET" && PROCESS_READ.test(pathname)) {
    entry.kind = "process-read";
    return holdable(world, "process", route, () =>
      route.fulfill(json(world.process)),
    );
  }
  if (method === "GET" && pathname === "/workflow-process/config") {
    entry.kind = "config-read";
    return route.fulfill(json(CONFIG));
  }
  if (method === "GET" && ACCESS_READ.test(pathname)) {
    entry.kind = "access-read";
    return holdable(world, "access", route, () =>
      world.access === 200
        ? route.fulfill(json({ id: DATASET_ID, name: DATASET_NAME }))
        : route.fulfill({ status: world.access, body: "" }),
    );
  }
  if (method === "GET" && pathname === "/storage/upload/allowed-extension") {
    return route.fulfill(json([".csv"]));
  }
  if (method === "GET" && pathname === "/vocabulary/fields-of-science") {
    return route.fulfill(json(FIELDS_OF_SCIENCE));
  }
  if (method === "GET" && pathname === "/vocabulary/license") {
    return route.fulfill(json(LICENSES));
  }
  if (method === "POST" && SHELL_POST_QUERIES.has(pathname)) {
    entry.kind = "shell-query";
    return route.fulfill(json({ items: [], count: 0 }));
  }
  if (
    method === "GET" &&
    SHELL_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    entry.kind = "shell-read";
    return route.fulfill(json({ items: [], count: 0 }));
  }

  // Grants, collection writes and anything else this flow must not call.
  entry.kind = "unexpected";
  world.unexpected.push(`${method} ${pathname}`);
  return route.fulfill({ status: 501, body: "" });
}

/**
 * The single route handler for a context: the app origin reaches the server
 * (with a synthetic `__env.js` and session), the synthetic Gateway is answered
 * by the stub, and every other origin is aborted and recorded as escaped.
 */
export function createRouteHandler(world, baseUrl) {
  const appOrigin = loopbackOrigin(baseUrl);
  return async (route) => {
    const url = route.request().url();
    const { target, local } = classifyRequest(url, appOrigin);
    switch (target) {
      case "app":
        if (local.startsWith("/__env.js")) {
          return route.fulfill({
            contentType: "application/javascript",
            body: ENV_BODY(appOrigin),
          });
        }
        if (local.startsWith("/api/auth/session")) {
          world.ledger.push({ method: "GET", path: local, kind: "session" });
          const { id, name, email, token } = world.account;
          return route.fulfill(
            json({
              user: { id, name, email },
              accessToken: token,
              expires: "2099-01-01T00:00:00.000Z",
            }),
          );
        }
        if (local.startsWith("/api/auth/csrf")) {
          return route.fulfill(json({ csrfToken: "synthetic-csrf" }));
        }
        if (local.startsWith("/api/auth/")) return route.fulfill(json({}));
        return route.continue();
      case "gateway":
        return answerGateway(route, world, local);
      case "inline":
        return route.continue();
      default:
        world.escaped.push(url);
        return route.abort();
    }
  };
}

/** A browser context whose every request is answered from `world`. */
export async function openContext(browser, world, { baseUrl, viewport }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });
  // The ordinary override the settings UI writes, in this context only.
  await context.addInitScript((flags) => {
    try {
      window.localStorage.setItem(
        "datagemsFeatureFlags",
        JSON.stringify(flags),
      );
    } catch {}
  }, world.flags);

  await context.route("**/*", createRouteHandler(world, baseUrl));

  const page = await context.newPage();
  return { context, page };
}

/**
 * Makes next-auth refetch the session in place (its own visibility refetch),
 * optionally answering for another account from now on.
 */
export async function refetchSession(page, world, account = world.account) {
  world.account = account;
  const sessions = world.count("session");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const deadline = Date.now() + 10_000;
  while (world.count("session") === sessions) {
    if (Date.now() > deadline) throw new Error("session was not refetched");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export function createReport() {
  const results = [];
  let current = "";
  let step = "";
  return {
    results,
    step(name) {
      step = name;
    },
    check(name, ok, detail = "") {
      results.push({ scenario: current, name, ok: Boolean(ok), detail });
      const line = `${ok ? "PASS" : "FAIL"} [${current}] ${name}`;
      console.log(detail ? `${line} — ${detail}` : line);
    },
    async scenario(name, run) {
      current = name;
      step = "start";
      try {
        await run();
      } catch (error) {
        const message = String(error?.message ?? error).split("\n")[0];
        results.push({
          scenario: name,
          name: `threw at step "${step}"`,
          ok: false,
          detail: message,
        });
        console.log(`FAIL [${name}] threw at step "${step}" — ${message}`);
      }
    },
  };
}
