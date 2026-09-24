/**
 * Dataset onboarding — repeatable browser journey.
 *
 * Drives the real application (root providers, dashboard layout, session
 * boundary, add-dataset form, processing page, adapter and transport) with the
 * installed Playwright driver and a synthetic session and Gateway. See the
 * "Browser journeys" section of README.md for the command, prerequisites and
 * what the run proves and does not prove.
 *
 * Exit code 0 only when every check passed and no request was unexpected or
 * escaped.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  FILE,
  PROCESS_ID,
  SUCCEEDED,
} from "./dataset-onboarding/fixtures.mjs";
import {
  createReport,
  createWorld,
  loopbackOrigin,
  openContext,
  refetchSession,
  startServer,
} from "./dataset-onboarding/harness.mjs";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { chromium } = createRequire(path.join(appRoot, "package.json"))(
  "playwright",
);

const DESKTOP = { width: 1440, height: 1000 };
const NARROW = { width: 390, height: 844 };
const SLOW = { timeout: 120_000 };
const SOON = { timeout: 15_000 };

const out =
  process.env.DG_BROWSER_OUT ??
  mkdtempSync(path.join(tmpdir(), "dg-dataset-onboarding-browser-"));
mkdirSync(out, { recursive: true });

const report = createReport();
const { check, step } = report;
let baseUrl = process.env.DG_BROWSER_BASE_URL;
let server = null;
let browser = null;
/** Every world, so escaped/unexpected requests are checked for the whole run. */
const worlds = [];

const world = (options = {}) => {
  const created = createWorld({ account: ACCOUNT_A, ...options });
  worlds.push(created);
  return created;
};

const shot = (page, name) =>
  page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });

const startButton = (page) =>
  page.getByRole("button", { name: "Start processing", exact: true });
const titleInput = (page) =>
  page.locator("input[placeholder='Enter dataset title']");
const updateStatus = (page) => page.locator("[id$='-update-status']");
const refreshButton = (page) =>
  page.getByRole("button", { name: "Refresh status", exact: true });

async function openForm(page) {
  await page.goto(`${baseUrl}/datasets/add`, { waitUntil: "domcontentloaded" });
  await startButton(page).waitFor(SLOW);
  // The markdown editor is loaded through `next/dynamic`, and the shell's
  // sidebar animates; let both settle before typing.
  await page
    .locator("textarea[placeholder^='Provide a detailed']")
    .waitFor(SLOW);
  await page.waitForTimeout(900);
}

async function uploadFile(page, file = FILE) {
  await page.setInputFiles('input[type="file"]', file);
  await page.getByText(file.name, { exact: true }).first().waitFor(SOON);
}

async function fillMetadata(page) {
  await titleInput(page).fill("Sensor readings 2026");
  await page
    .locator("input[placeholder='Enter short headline']")
    .fill("Pilot network readings");
  await page
    .locator("textarea[placeholder^='Provide a detailed']")
    .fill("Hourly readings from the pilot network.");
  const keywords = page.locator("input[placeholder^='Separate with commas']");
  await keywords.fill("sensors");
  await keywords.press("Enter");
  await page.getByText("Natural sciences").click();
  await page.getByText("Earth and related environmental sciences").click();
  await page.getByText("Select a license").click();
  await page.getByRole("button", { name: "CC BY 4.0" }).click();
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);
const SHARING = /Who can access|Restricted|Public access|shar(e|ing)/i;

const noOverflow = (page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth <= 1,
  );

async function waitFor(predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
}

// ---------------------------------------------------------------------------

async function startAndReload() {
  const w = world();
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });

  step("fill the form");
  await openForm(page);
  const text = await bodyText(page);
  check(
    "private creation shows no collection or sharing step",
    !SHARING.test(text) && !/\bCollection\b/.test(text),
  );
  await uploadFile(page);
  await page.getByText("File uploaded").waitFor(SOON);
  await fillMetadata(page);
  check(
    "upload and form entry send no start",
    w.count("start") === 0 && w.count("upload") === 1,
    `starts=${w.count("start")} uploads=${w.count("upload")}`,
  );

  step("deliberate start");
  await startButton(page).click();
  await page.waitForURL(
    new RegExp(`/datasets/onboarding/${PROCESS_ID}$`),
    SLOW,
  );
  await page.locator("h1#dataset-processing-heading").waitFor(SLOW);
  await page.waitForTimeout(1200);
  const starts = w.since(0, "start");
  check(
    "exactly one start, one upload, navigated by the returned process id",
    starts.length === 1 && w.count("upload") === 1,
    `starts=${starts.length} uploads=${w.count("upload")}`,
  );
  check(
    "the start carries the signed-in account's token",
    starts[0]?.auth === `Bearer ${ACCOUNT_A.token}`,
  );
  check("processing page reads the process", w.count("process-read") > 0);
  await shot(page, "01-processing-after-start");

  step("reload");
  const beforeReload = w.mark();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("h1#dataset-processing-heading").waitFor(SLOW);
  await page.waitForTimeout(1500);
  check(
    "reload recovers by reading, with no start or upload",
    w.since(beforeReload, "start").length === 0 &&
      w.since(beforeReload, "upload").length === 0 &&
      w.since(beforeReload, "process-read").length > 0,
    `process reads after reload=${w.since(beforeReload, "process-read").length}`,
  );
  check(
    "grants, collection writes and unknown calls: none",
    w.unexpected.length === 0,
    w.unexpected.join(", "),
  );
  await context.close();
}

async function failedFileAndUploaderControls() {
  const w = world({ upload: "fail" });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });

  step("failed upload");
  await openForm(page);
  await uploadFile(page);
  await page.getByText("Upload failed").waitFor(SOON);
  await fillMetadata(page);
  await startButton(page).click();
  const notice = page.getByText("Some files need attention");
  await notice.waitFor(SOON);
  const feedback = await page
    .locator('[data-testid="submission-feedback"]')
    .innerText();
  check(
    "a failed file prevents the start",
    w.count("start") === 0,
    `starts=${w.count("start")}`,
  );
  check(
    "the notice names the file with a safe action",
    feedback.includes(FILE.name) &&
      /Retry the upload|remove this file/i.test(feedback),
    feedback.replace(/\s+/g, " "),
  );
  check(
    "no server error text is rendered",
    !(await page.content()).includes("disk full"),
  );
  await shot(page, "02-failed-file");

  step("make the form ready");
  w.upload = "ok";
  await page.getByRole("button", { name: "Remove file" }).click();
  await uploadFile(page);
  await page.getByText("File uploaded").waitFor(SOON);
  const mark = w.mark();

  step("Browse local files");
  const chooser = page.waitForEvent("filechooser", SOON);
  await page.getByRole("button", { name: "Browse local files" }).click();
  check("Browse local files opens the file chooser", Boolean(await chooser));
  await page.waitForTimeout(500);

  step("Add remote location");
  await page.getByRole("button", { name: "Add remote location" }).click();
  const remote = page.getByText("Choose remote location");
  check("Add remote location opens the remote panel", await remote.isVisible());

  step("remote Upload dataset");
  await page.getByRole("button", { name: /Direct url/ }).click();
  await page
    .getByPlaceholder("https://server.com/file.csv...")
    .fill("https://server.com/readings.csv");
  await page.getByRole("button", { name: "Upload dataset" }).click();
  await page
    .getByText("Remote URL upload requires administrator privileges.")
    .first()
    .waitFor(SOON);
  check(
    "remote Upload keeps its refusal message and closes the panel",
    !(await remote.isVisible()),
  );
  await page.waitForTimeout(800);
  check(
    "none of the three uploader controls submitted the ready form",
    w.since(mark, "start").length === 0 &&
      w.since(mark, "upload").length === 0 &&
      page.url().endsWith("/datasets/add"),
    `starts=${w.since(mark, "start").length} url=${page.url()}`,
  );
  check(
    "no unexpected Gateway call",
    w.unexpected.length === 0,
    w.unexpected.join(", "),
  );
  await context.close();
}

async function lostAndRefusedStart() {
  const w = world({ start: "lose" });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });

  step("lost start response");
  await openForm(page);
  await uploadFile(page);
  await page.getByText("File uploaded").waitFor(SOON);
  await fillMetadata(page);
  await startButton(page).click();
  await page.getByText("We couldn't confirm your submission").waitFor(SOON);
  check(
    "a lost response is uncertain, not a refusal",
    !(await page.getByText("Your dataset wasn't created").isVisible()),
  );

  step("attempted resubmit");
  await startButton(page).click();
  await page.waitForTimeout(1500);
  check(
    "a second submit replays nothing and re-uses no upload",
    w.count("start") === 1 && w.count("upload") === 1,
    `starts=${w.count("start")} uploads=${w.count("upload")}`,
  );
  check(
    "the outcome stays uncertain on the form",
    (await page.getByText("We couldn't confirm your submission").isVisible()) &&
      page.url().endsWith("/datasets/add"),
  );
  check(
    "no grant, collection or unknown call",
    w.unexpected.length === 0,
    w.unexpected.join(", "),
  );
  await shot(page, "03-lost-start-response");
  await context.close();

  step("definite refusal");
  const r = world({ start: "refuse" });
  const refused = await openContext(browser, r, { baseUrl, viewport: DESKTOP });
  await openForm(refused.page);
  await uploadFile(refused.page);
  await refused.page.getByText("File uploaded").waitFor(SOON);
  await fillMetadata(refused.page);
  await startButton(refused.page).click();
  await refused.page.getByText("Your dataset wasn't created").waitFor(SOON);
  check(
    "a refusal is stated as not created, not as uncertain",
    r.count("start") === 1 &&
      !(await refused.page
        .getByText("We couldn't confirm your submission")
        .isVisible()),
  );
  await refused.context.close();
}

async function flagsOff() {
  for (const [label, flags] of [
    [
      "monitoring rollout flag off",
      { datasetOnboarding: true, datasetOnboardingMonitoring: false },
    ],
    [
      "onboarding flag off",
      { datasetOnboarding: false, datasetOnboardingMonitoring: true },
    ],
  ]) {
    step(label);
    const w = world({ flags });
    const { context, page } = await openContext(browser, w, {
      baseUrl,
      viewport: DESKTOP,
    });
    await page.goto(`${baseUrl}/datasets/add`, {
      waitUntil: "domcontentloaded",
    });
    if (flags.datasetOnboarding) {
      // The page stays reachable and states that adding is unavailable.
      await page
        .getByText("Adding datasets is currently unavailable")
        .waitFor(SLOW);
      const submit = startButton(page);
      const disabled = await submit.isDisabled();
      await submit.click({ force: true });
      await page.waitForTimeout(800);
      check(
        `${label}: creation is unavailable and nothing is sent`,
        disabled && w.count("start") === 0 && w.count("upload") === 0,
        `disabled=${disabled} starts=${w.count("start")}`,
      );
    } else {
      // The page's own flag guard redirects away from the form.
      await page.waitForURL(
        (url) => !url.pathname.startsWith("/datasets/add"),
        SLOW,
      );
      check(
        `${label}: the form redirects away and nothing is sent`,
        (await startButton(page).count()) === 0 &&
          w.count("start") === 0 &&
          w.count("upload") === 0,
        `url=${page.url()}`,
      );
    }

    await page.goto(`${baseUrl}/datasets/onboarding/${PROCESS_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("h1#dataset-processing-heading").waitFor(SLOW);
    await page.waitForTimeout(1200);
    check(
      `${label}: an existing process is still monitored`,
      w.count("process-read") > 0 &&
        (await page.locator("ol li").count()) === 3,
      `process reads=${w.count("process-read")}`,
    );
    await context.close();
  }
}

async function refreshActivity() {
  const w = world();
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: NARROW,
  });

  step("open a running process");
  await page.goto(`${baseUrl}/datasets/onboarding/${PROCESS_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("h1#dataset-processing-heading").waitFor(SLOW);
  await page.getByText("Updates automatically").waitFor(SLOW);

  step("held process and access reads");
  // Refresh status rechecks the process and, once the dataset id is known,
  // access too; both are held so their overlap is observable.
  w.hold.add("process");
  w.hold.add("access");
  const beforeRefresh = w.mark();
  await refreshButton(page).focus();
  await page.keyboard.press("Enter");
  const updating = await waitFor(
    async () => (await updateStatus(page).innerText()) === "Updating…",
  );
  check(
    "a dispatched process read shows Updating…",
    updating && w.since(beforeRefresh, "process-read").length > 0,
  );
  const focusKept = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute("aria-label") === "Refresh status",
    );
  check("Refresh keeps focus on its control", await focusKept());
  await shot(page, "04-updating-narrow");

  step("process settles, access read held");
  w.process = SUCCEEDED;
  w.hold.delete("process");
  w.release("process");
  await page.waitForTimeout(800);
  check(
    "a held access read keeps Updating… after the process read settles",
    w.held.some((entry) => entry.kind === "access") &&
      w.held.every((entry) => entry.kind === "access") &&
      (await updateStatus(page).innerText()) === "Updating…",
  );
  check(
    "View dataset waits for confirmed readability",
    !(await page.getByRole("button", { name: "View dataset" }).isVisible()),
  );

  step("access settles");
  w.hold.delete("access");
  w.release("access");
  await page.getByRole("button", { name: "View dataset" }).waitFor(SOON);
  const settled = await waitFor(
    async () =>
      (await updateStatus(page).count()) === 0 ||
      (await updateStatus(page).innerText()) !== "Updating…",
  );
  check(
    "Updating… stops once both reads settle; readability enables View dataset",
    settled && w.held.length === 0,
  );
  check(
    "no sharing warning for a private creation",
    !SHARING.test(await bodyText(page)),
  );
  check("focus did not move during refresh", await focusKept());
  check("no horizontal overflow at 390px", await noOverflow(page));
  check(
    "reads only: no start, upload or unknown call",
    w.count("start") === 0 &&
      w.count("upload") === 0 &&
      w.unexpected.length === 0,
    w.unexpected.join(", "),
  );
  await shot(page, "05-readable-narrow");
  await context.close();
}

async function ownership() {
  const w = world();
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  const cards = (name) => page.getByText(name, { exact: true });

  step("valid-scope refresh");
  await openForm(page);
  await uploadFile(page);
  await page.getByText("File uploaded").waitFor(SOON);
  await titleInput(page).fill("Sensor readings 2026");
  await refetchSession(page, w);
  check(
    "a same-account session refresh keeps the draft and file",
    (await titleInput(page).inputValue()) === "Sensor readings 2026" &&
      (await cards(FILE.name).count()) > 0,
  );

  step("late upload across an account change");
  w.hold.add("upload");
  const late = { ...FILE, name: "late.csv" };
  await uploadFile(page, late);
  check(
    "A's second upload is in flight",
    await waitFor(async () => w.held.some((entry) => entry.kind === "upload")),
  );
  await refetchSession(page, w, ACCOUNT_B);
  await page.waitForTimeout(500);
  check(
    "account B sees none of A's draft or files",
    (await titleInput(page).inputValue()) === "" &&
      (await cards(FILE.name).count()) === 0 &&
      (await cards(late.name).count()) === 0,
  );
  w.hold.delete("upload");
  w.release("upload");
  await page.waitForTimeout(1200);
  check(
    "A's late upload does not land for B",
    (await cards(late.name).count()) === 0,
  );
  await refetchSession(page, w, ACCOUNT_A);
  await page.waitForTimeout(500);
  check(
    "returning to A does not restore the draft or late upload",
    (await titleInput(page).inputValue()) === "" &&
      (await cards(FILE.name).count()) === 0 &&
      (await cards(late.name).count()) === 0,
  );
  await context.close();

  step("consumed references across an account change");
  const c = world({ start: "lose" });
  const second = await openContext(browser, c, { baseUrl, viewport: DESKTOP });
  await openForm(second.page);
  await uploadFile(second.page);
  await second.page.getByText("File uploaded").waitFor(SOON);
  await fillMetadata(second.page);
  await startButton(second.page).click();
  await second.page
    .getByText("We couldn't confirm your submission")
    .waitFor(SOON);
  await refetchSession(second.page, c, ACCOUNT_B);
  await refetchSession(second.page, c, ACCOUNT_A);
  const backToA = c.mark();
  await startButton(second.page).click();
  await second.page.waitForTimeout(1500);
  check(
    "after B and back to A, nothing restarts from consumed references",
    c.count("start") === 1 &&
      c.count("upload") === 1 &&
      (await second.page.getByText(FILE.name, { exact: true }).count()) === 0,
    `starts=${c.count("start")} uploads=${c.count("upload")}`,
  );
  const gatewayAfterB = c
    .since(backToA)
    .filter((entry) => entry.kind !== "session" && entry.auth !== null);
  check(
    "no Gateway request after switching back used B's token",
    gatewayAfterB.every((entry) => entry.auth === `Bearer ${ACCOUNT_A.token}`),
  );
  check(
    "no unexpected Gateway call",
    w.unexpected.length === 0 && c.unexpected.length === 0,
    [...w.unexpected, ...c.unexpected].join(", "),
  );
  await second.context.close();
}

// ---------------------------------------------------------------------------

async function main() {
  if (baseUrl) {
    baseUrl = loopbackOrigin(baseUrl);
  } else {
    const port = Number(process.env.DG_BROWSER_PORT ?? 3118);
    server = await startServer({
      appRoot,
      port,
      logFile: path.join(out, "next-dev.log"),
    });
    baseUrl = server.baseUrl;
  }
  console.log(`App: ${baseUrl}\nOutput: ${out}`);

  const channel = process.env.DG_BROWSER_CHANNEL ?? "chrome";
  browser = await chromium.launch({
    ...(channel === "bundled" ? {} : { channel }),
    headless: process.env.DG_BROWSER_HEADED !== "1",
  });

  await report.scenario("upload, start and reload", startAndReload);
  await report.scenario(
    "failed file and uploader controls",
    failedFileAndUploaderControls,
  );
  await report.scenario("lost and refused start", lostAndRefusedStart);
  await report.scenario("flags off", flagsOff);
  await report.scenario("refresh activity at 390px", refreshActivity);
  await report.scenario("session ownership", ownership);

  await report.scenario("request boundaries", async () => {
    const escaped = worlds.flatMap((w) => w.escaped);
    const unexpected = worlds.flatMap((w) => w.unexpected);
    check(
      "no request escaped the loopback app and synthetic Gateway",
      escaped.length === 0,
      escaped.join(", "),
    );
    check(
      "no unexpected Gateway request",
      unexpected.length === 0,
      unexpected.join(", "),
    );
  });
}

let exitCode = 1;
try {
  await main();
  const failed = report.results.filter((result) => !result.ok);
  const operations = worlds.map((w) =>
    w.ledger
      .filter(
        (entry) => entry.kind !== "background" && entry.kind !== "session",
      )
      .map((entry) => `${entry.kind} ${entry.method} ${entry.path}`),
  );
  writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify({ results: report.results, operations }, null, 2),
  );
  console.log(
    `\n${report.results.length - failed.length}/${report.results.length} checks passed. Output: ${out}`,
  );
  exitCode = failed.length === 0 ? 0 : 1;
} catch (error) {
  console.error(`Run failed: ${error?.stack ?? error}`);
} finally {
  await browser?.close();
  await server?.stop();
}
process.exit(exitCode);
