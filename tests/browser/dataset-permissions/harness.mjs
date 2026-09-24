/**
 * Harness for the dataset-permissions browser journey.
 *
 * - The application server is the real Next.js dev server, bound to 127.0.0.1
 *   and owned by this run (or an already-running loopback server you name).
 * - Every request leaving the page is routed here. Loopback requests reach the
 *   app, except `/__env.js` and `/api/auth/*`, which are synthetic. Requests to
 *   the synthetic Gateway are answered by a strict stub: an unknown Gateway
 *   route is recorded as unexpected and fails the run. Anything addressed to
 *   any other origin is aborted and recorded as escaped, and also fails.
 * - No real credential, dataset or permission is involved.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { GATEWAY } from "./fixtures.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The exact origin of a loopback `http` base URL, e.g. `http://127.0.0.1:3317`.
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
 * prefix. `local` and `gateway` carry the path and query to classify further.
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

const portIsFree = (port) =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });

/** Starts `next dev` on 127.0.0.1:<port>; never touches a server it did not start. */
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

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
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

  const stop = async () => {
    if (child.exitCode !== null) return;
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
 * `mutation` decides how the next context-grant write is answered: `ok`
 * (204, and later recipient reads reflect it), `refuse` (403), `lose` (the
 * connection is dropped after dispatch, so the outcome is unknown) or `hold`
 * (kept open until {@link World.release}).
 */
export function createWorld(options) {
  const world = {
    flag: true,
    account: options.account,
    globalPermissions: [],
    datasetPermissions: undefined,
    groups: [],
    grants: {},
    recipientReadStatus: 200,
    datasetActionPermissions: [],
    selfGrants: [],
    mutation: "ok",
    ...options,
    ledger: [],
    unexpected: [],
    escaped: [],
    held: [],
    release(status = 204) {
      const pending = world.held.splice(0);
      for (const entry of pending) entry.resolve(status);
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
  };
  world.grants = structuredClone(world.grants);
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

const MUTATION =
  /^\/principal\/context-grants\/group\/([^/]+)\/dataset\/([^/]+)\/role\/([^/?]+)$/;
const RECIPIENT_READ =
  /^\/principal\/group\/([^/]+)\/context-grants\/dataset\?id=(.+)$/;

async function answerGateway(route, world, datasetId, pathname) {
  const request = route.request();
  const method = request.method();
  const entry = {
    method,
    path: pathname,
    auth: request.headers().authorization ?? null,
    kind: "background",
  };
  world.ledger.push(entry);

  const mutation = pathname.match(MUTATION);
  if (mutation && (method === "POST" || method === "DELETE")) {
    entry.kind = "mutation";
    entry.group = decodeURIComponent(mutation[1]);
    entry.role = decodeURIComponent(mutation[3]);
    const apply = (status) => {
      if (status >= 200 && status < 300) {
        const roles = new Set(world.grants[entry.group] ?? []);
        if (method === "POST") roles.add(entry.role);
        else roles.delete(entry.role);
        world.grants[entry.group] = [...roles];
      }
      return route.fulfill({ status, body: "" });
    };
    switch (world.mutation) {
      case "refuse":
        return route.fulfill({ status: 403, body: "" });
      case "lose":
        return route.abort("connectionreset");
      case "hold":
        return new Promise((resolve) => {
          world.held.push({ resolve: (status) => resolve(apply(status)) });
        });
      default:
        return apply(204);
    }
  }

  const recipient = pathname.match(RECIPIENT_READ);
  if (recipient && method === "GET") {
    entry.kind = "recipient-read";
    entry.group = decodeURIComponent(recipient[1]);
    if (world.recipientReadStatus !== 200) {
      return route.fulfill({ status: world.recipientReadStatus, body: "" });
    }
    return route.fulfill(
      json({ [datasetId]: world.grants[entry.group] ?? [] }),
    );
  }

  if (method === "GET" && pathname === "/principal/me?f=permissions") {
    entry.kind = "capability-read";
    return route.fulfill(
      json({ id: world.account.id, permissions: world.globalPermissions }),
    );
  }
  if (method === "GET" && pathname === "/principal/me/context-grants") {
    return route.fulfill(json(world.selfGrants));
  }
  if (
    method === "GET" &&
    pathname.startsWith(`/dataset/${datasetId}?`) &&
    pathname.includes("f=permissions.addUserToContextGrantGroup")
  ) {
    // Dataset-context capability projection: the names the caller holds
    // through an affiliated role on this dataset (none unless a world says so).
    entry.kind = "capability-read";
    return route.fulfill(
      json({ id: datasetId, permissions: world.datasetActionPermissions }),
    );
  }
  if (method === "GET" && pathname.startsWith(`/dataset/${datasetId}?`)) {
    return route.fulfill(
      json({
        id: datasetId,
        name: world.datasetName,
        description: "Synthetic dataset for a local interface check.",
        ...(world.datasetPermissions === undefined
          ? {}
          : { permissions: world.datasetPermissions }),
      }),
    );
  }
  if (method === "POST" && pathname === "/user/group/query") {
    entry.kind = "groups";
    entry.body = request.postData() ?? "";
    return route.fulfill(
      json({ items: world.groups, count: world.groups.length }),
    );
  }
  if (method === "POST" && pathname === "/dataset/query") {
    return route.fulfill(
      json({ items: [{ id: datasetId, name: world.datasetName }], count: 1 }),
    );
  }
  if (
    (method === "POST" &&
      (pathname === "/conversation/me/query" ||
        pathname === "/collection/query")) ||
    (method === "GET" &&
      (pathname.startsWith("/user/settings/favorites/dataset?") ||
        pathname.startsWith(`/search/dataset/${datasetId}/recommend?`)))
  ) {
    return route.fulfill(json({ items: [], count: 0 }));
  }
  if (
    method === "GET" &&
    pathname.startsWith("/user/settings/key/notificationSettings?")
  ) {
    return route.fulfill(json([]));
  }

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
        if (local.startsWith("/api/auth/")) return route.fulfill(json({}));
        return route.continue();
      case "gateway":
        return answerGateway(route, world, world.datasetId, local);
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
  const context = await browser.newContext({ viewport });
  await context.addInitScript((flag) => {
    try {
      window.localStorage.setItem(
        "datagemsFeatureFlags",
        JSON.stringify({ datasetGroupAccess: flag }),
      );
    } catch {}
  }, world.flag);

  await context.route("**/*", createRouteHandler(world, baseUrl));

  const page = await context.newPage();
  return { context, page };
}

/**
 * Switches the signed-in account in place: the session route starts
 * answering for `account`, and next-auth's own focus refetch picks it up.
 */
export async function switchAccount(page, world, account) {
  world.account = account;
  const sessions = world.since(0, "session").length;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const deadline = Date.now() + 10_000;
  while (world.since(0, "session").length === sessions) {
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

/** Whether the focused element is inside `locator`'s element. */
export const focusInside = (locator) =>
  locator.evaluate((element) => element.contains(document.activeElement));

/** A short description of the focused element. */
export const describeFocus = (page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return "body";
    const name =
      element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
    return `${element.tagName.toLowerCase()}[${element.getAttribute("role") ?? ""}] ${name.slice(0, 60)}`;
  });

/** Presses `key` `count` times and reports whether focus stayed in `locator`. */
export async function focusStaysInside(page, locator, key, count) {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press(key);
    if (!(await focusInside(locator))) {
      return { ok: false, detail: `left after ${index + 1} × ${key}` };
    }
  }
  return { ok: true, detail: `${count} × ${key}` };
}

/** Whether the element lies wholly inside the viewport horizontally. */
export async function withinViewportWidth(page, locator) {
  const box = await locator.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  return {
    ok: box !== null && box.x >= 0 && box.x + box.width <= width + 0.5,
    detail: box === null ? "no box" : `x=${box.x} w=${box.width} vw=${width}`,
  };
}
