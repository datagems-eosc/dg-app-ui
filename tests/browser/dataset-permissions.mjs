/**
 * Dataset permissions — repeatable browser journey.
 *
 * Drives the real application with the installed Playwright driver and a
 * synthetic session and Gateway. See `dataset-permissions/README.md` for the
 * command, prerequisites and what the run proves and does not prove.
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
  AMBIGUOUS_GROUPS,
  DATASET,
  DETAILS_PERMISSIONS,
  EVERYONE,
  FULL_EDITOR,
  GRANT,
  GRANT_ONLY,
  MARINE,
  PUBLIC_A,
  PUBLIC_B,
  READ_ONLY,
  RESEARCH,
  ROLE_LABELS,
  STANDARD_GROUPS,
  selfManageGrant,
} from "./dataset-permissions/fixtures.mjs";
import {
  createReport,
  createWorld,
  describeFocus,
  focusInside,
  focusStaysInside,
  loopbackOrigin,
  openContext,
  startServer,
  switchAccount,
  withinViewportWidth,
} from "./dataset-permissions/harness.mjs";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { chromium } = createRequire(path.join(appRoot, "package.json"))(
  "playwright",
);

const DESKTOP = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };
const SLOW = { timeout: 120_000 };

const out =
  process.env.DG_BROWSER_OUT ??
  mkdtempSync(path.join(tmpdir(), "dg-dataset-permissions-browser-"));
mkdirSync(out, { recursive: true });

const report = createReport();
const { check, step } = report;
let baseUrl = process.env.DG_BROWSER_BASE_URL;
let server = null;
let browser = null;
/** Every world, so escaped/unexpected requests are checked for the whole run. */
const worlds = [];

const world = (options) => {
  const created = createWorld({
    account: ACCOUNT_A,
    datasetId: DATASET.id,
    datasetName: DATASET.name,
    groups: STANDARD_GROUPS,
    globalPermissions: FULL_EDITOR,
    datasetPermissions: DETAILS_PERMISSIONS.known,
    selfGrants: selfManageGrant(ACCOUNT_A),
    ...options,
  });
  worlds.push(created);
  return created;
};

const shot = (page, name, locator) =>
  (locator ?? page).screenshot({ path: path.join(out, `${name}.png`) });

const mainDialog = (page) =>
  page.getByRole("dialog", { name: DATASET.name, exact: true });
const roleSwitch = (page, group, role) =>
  page.getByRole("switch", { name: `${group.name} — ${role}`, exact: true });
const detailsLauncher = (page) =>
  page.getByRole("button", { name: "Manage access", exact: true });
const settingsLauncher = (page) =>
  page.getByRole("button", { name: `Manage access to ${DATASET.name}` });
const permissionsSidebar = (page) =>
  page
    .getByRole("heading", { level: 3, name: "Your permissions", exact: true })
    .locator("xpath=ancestor::div[3]");

async function openDetails(page) {
  await page.goto(`${baseUrl}/datasets/${DATASET.id}`);
  await page
    .getByRole("heading", { level: 3, name: "Your permissions", exact: true })
    .waitFor(SLOW);
}

async function openAccessByKeyboard(page) {
  await detailsLauncher(page).focus();
  await page.keyboard.press("Enter");
  await mainDialog(page).waitFor(SLOW);
}

const noNewMutations = (w, mark) => w.since(mark, "mutation").length === 0;
const describeMutations = (entries) =>
  entries.map((entry) => `${entry.method} ${entry.path}`).join(", ") || "none";

// ---------------------------------------------------------------------------

async function sidebarStates() {
  for (const viewport of [DESKTOP, NARROW]) {
    for (const [state, permissions, expected] of [
      ["known", DETAILS_PERMISSIONS.known, null],
      ["empty", DETAILS_PERMISSIONS.empty, "No permissions shown"],
      ["unavailable", DETAILS_PERMISSIONS.missing, "Permissions unavailable"],
    ]) {
      step(`${state} at ${viewport.width}`);
      // No self context grant: the page would otherwise add its role label.
      const w = world({ datasetPermissions: permissions, selfGrants: [] });
      const { context, page } = await openContext(browser, w, {
        baseUrl,
        viewport,
      });
      await openDetails(page);
      const section = permissionsSidebar(page);
      const text = await section.innerText();
      const tag = `${viewport.width} ${state}`;
      check(`${tag}: heading is sentence case`, !/Your Permissions/.test(text));
      if (expected === null) {
        check(
          `${tag}: only Browse and Edit chips, no empty/unavailable text`,
          /Browse/.test(text) &&
            /Edit/.test(text) &&
            !/\bManage\b(?! access)/.test(text) &&
            !/No permissions shown|Permissions unavailable/.test(text),
          text.replace(/\s+/g, " "),
        );
      } else {
        const other =
          expected === "No permissions shown"
            ? "Permissions unavailable"
            : "No permissions shown";
        check(
          `${tag}: shows “${expected}” and not “${other}”`,
          text.includes(expected) && !text.includes(other),
          text.replace(/\s+/g, " "),
        );
      }
      const fits = await withinViewportWidth(page, section);
      check(`${tag}: section within viewport width`, fits.ok, fits.detail);
      await shot(page, `sidebar-${state}-${viewport.width}`, section);
      await context.close();
    }
  }
}

async function fullEditorJourney() {
  const w = world({ grants: { [RESEARCH.id]: ["dg_ds-browse"] } });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });

  step("open from details by keyboard");
  await openDetails(page);
  const beforeOpen = w.mark();
  await openAccessByKeyboard(page);
  const dialog = mainDialog(page);
  await roleSwitch(page, RESEARCH, "Browse").waitFor(SLOW);
  check("dialog takes focus on open", await focusInside(dialog));
  check(
    "full editor: 3 groups × 6 permissions",
    (await dialog.getByRole("switch").count()) === 18,
  );
  check(
    "known Research Team Browse assignment is shown on",
    (await roleSwitch(page, RESEARCH, "Browse").getAttribute(
      "aria-checked",
    )) === "true",
  );
  const reads = w.since(beforeOpen, "recipient-read");
  check(
    "recipient reads only for discovered groups",
    reads.length >= 3 &&
      reads.every((entry) =>
        STANDARD_GROUPS.some((group) => group.id === entry.group),
      ),
    `${reads.length} reads`,
  );
  check(
    "all reads carry account A's token",
    w
      .since(beforeOpen)
      .every(
        (e) => e.kind === "session" || e.auth === `Bearer ${ACCOUNT_A.token}`,
      ),
  );
  let stay = await focusStaysInside(page, dialog, "Tab", 30);
  check("Tab stays inside the dialog", stay.ok, stay.detail);
  stay = await focusStaysInside(page, dialog, "Shift+Tab", 10);
  check("Shift+Tab stays inside the dialog", stay.ok, stay.detail);
  await shot(page, "full-editor-1440");

  step("one deliberate grant with the pending guard");
  w.mutation = "hold";
  const beforeGrant = w.mark();
  const edit = roleSwitch(page, RESEARCH, "Edit");
  await edit.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  check(
    "pending switch keeps focus and is aria-disabled",
    (await edit.evaluate((el) => el === document.activeElement)) &&
      (await edit.getAttribute("aria-disabled")) === "true",
    await describeFocus(page),
  );
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await edit.click({ force: true });
  await page.waitForTimeout(400);
  const pendingWrites = w.since(beforeGrant, "mutation");
  check(
    "exactly one POST for Research Team Edit while pending (Space, Enter, click repeated)",
    pendingWrites.length === 1 &&
      pendingWrites[0].method === "POST" &&
      pendingWrites[0].path ===
        `/principal/context-grants/group/${RESEARCH.id}/dataset/${DATASET.id}/role/dg_ds-edit` &&
      pendingWrites[0].auth === `Bearer ${ACCOUNT_A.token}`,
    describeMutations(pendingWrites),
  );
  const afterWrite = w.mark();
  check("held response released", w.release(204) === 1);
  await dialog.getByText("Edit permission granted.").waitFor(SLOW);
  await page.waitForTimeout(600);
  check(
    "acknowledged: switch on, enabled and still focused",
    (await edit.getAttribute("aria-checked")) === "true" &&
      (await edit.getAttribute("aria-disabled")) === null &&
      (await edit.evaluate((el) => el === document.activeElement)),
    await describeFocus(page),
  );
  check(
    "reconciliation reads Research Team only after the write",
    w
      .since(afterWrite, "recipient-read")
      .some((entry) => entry.group === RESEARCH.id),
  );
  w.mutation = "ok";

  step("nested confirmation and Escape");
  const beforeNested = w.mark();
  const manage = roleSwitch(page, RESEARCH, "Manage");
  await manage.focus();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", {
    name: "Grant Manage permission?",
  });
  await confirm.waitFor(SLOW);
  check("confirmation takes focus", await focusInside(confirm));
  stay = await focusStaysInside(page, confirm, "Tab", 8);
  check("Tab stays inside the confirmation", stay.ok, stay.detail);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(
    "one Escape closes only the confirmation",
    (await confirm.count()) === 0 && (await dialog.isVisible()),
  );
  check(
    "focus returns to the Manage switch",
    await manage.evaluate((el) => el === document.activeElement),
    await describeFocus(page),
  );
  check(
    "page stays scroll-locked",
    (await page.evaluate(() => document.body.style.overflow)) === "hidden",
  );
  check(
    "cancelled confirmation sends nothing",
    noNewMutations(w, beforeNested),
  );

  step("close restores the launcher");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 10_000 });
  check(
    "Escape closes and focus returns to Manage access",
    await detailsLauncher(page).evaluate((el) => el === document.activeElement),
    await describeFocus(page),
  );
  check(
    "scroll lock released",
    (await page.evaluate(() => document.body.style.overflow)) !== "hidden",
  );

  step("refresh and reopen");
  const beforeRefresh = w.mark();
  await page.reload();
  await page
    .getByRole("heading", { level: 3, name: "Your permissions" })
    .waitFor(SLOW);
  await openAccessByKeyboard(page);
  await roleSwitch(page, RESEARCH, "Edit").waitFor(SLOW);
  await page.waitForTimeout(800);
  check(
    "after refresh the acknowledged Edit grant is read back",
    (await roleSwitch(page, RESEARCH, "Edit").getAttribute("aria-checked")) ===
      "true",
  );
  check("refresh and reopen send nothing", noNewMutations(w, beforeRefresh));
  await page.getByRole("button", { name: "Done" }).click();
  await mainDialog(page).waitFor({ state: "detached", timeout: 10_000 });
  check(
    "Done restores focus to Manage access",
    await detailsLauncher(page).evaluate((el) => el === document.activeElement),
    await describeFocus(page),
  );

  const all = w.since(0, "mutation");
  check(
    "journey total: one mutation, no DELETE",
    all.length === 1 && all[0].method === "POST",
    describeMutations(all),
  );
  await context.close();
}

async function lostResponseAndAccounts() {
  const w = world({
    grants: { [RESEARCH.id]: ["dg_ds-browse"] },
    mutation: "lose",
  });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  const download = () => roleSwitch(page, MARINE, "Download");
  const uncertainNow = "Download: we couldn't confirm whether it was granted.";
  const uncertainRestored =
    "Download: we couldn't confirm whether an earlier grant was applied.";

  step("lose the response");
  await openDetails(page);
  await openAccessByKeyboard(page);
  await download().waitFor(SLOW);
  await download().click();
  await mainDialog(page)
    .getByText(uncertainNow, { exact: false })
    .waitFor(SLOW);
  check(
    "dataset summary names one unconfirmed change",
    await mainDialog(page)
      .getByText("We couldn't confirm one access change.")
      .isVisible(),
  );
  const first = w.since(0, "mutation");
  check(
    "exactly one POST was dispatched",
    first.length === 1 &&
      first[0].method === "POST" &&
      first[0].group === MARINE.id &&
      first[0].role === "dg_ds-download",
    describeMutations(first),
  );

  step("no replay or inverse");
  w.mutation = "ok";
  const beforeRetry = w.mark();
  await download().focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await download().click({ force: true });
  await page.waitForTimeout(600);
  check(
    "uncertain switch is held: Space, Enter and click send nothing",
    (await download().getAttribute("aria-disabled")) === "true" &&
      noNewMutations(w, beforeRetry),
    describeMutations(w.since(beforeRetry, "mutation")),
  );
  await shot(page, "uncertain-1440");

  step("reopen and refresh");
  await page.getByRole("button", { name: "Done" }).click();
  await mainDialog(page).waitFor({ state: "detached", timeout: 10_000 });
  await openAccessByKeyboard(page);
  await mainDialog(page).getByText(uncertainRestored).waitFor(SLOW);
  check("reopen restores the unconfirmed change", true);
  await page.reload();
  await page
    .getByRole("heading", { level: 3, name: "Your permissions" })
    .waitFor(SLOW);
  await openAccessByKeyboard(page);
  await mainDialog(page).getByText(uncertainRestored).waitFor(SLOW);
  check(
    "refresh keeps the change unresolved and held",
    (await download().getAttribute("aria-disabled")) === "true",
  );
  check("reopen and refresh send nothing", noNewMutations(w, beforeRetry));
  await shot(page, "uncertain-restored-1440");

  step("switch to account B with the dialog open");
  const beforeSwitch = w.mark();
  await switchAccount(page, w, ACCOUNT_B);
  if ((await mainDialog(page).count()) === 0) {
    await openAccessByKeyboard(page);
  }
  await download().waitFor(SLOW);
  await page.waitForTimeout(800);
  const dialogText = await mainDialog(page).innerText();
  check(
    "account B sees none of A's unconfirmed changes",
    !/couldn't confirm/.test(dialogText),
  );
  check(
    "account B's Marine Download switch is not held",
    (await download().getAttribute("aria-disabled")) === null &&
      !(await download().isDisabled()),
  );
  const afterSwitch = w
    .since(beforeSwitch)
    .filter((entry) => entry.kind !== "session" && entry.auth !== undefined);
  check(
    "every Gateway request after the switch carries B's token",
    afterSwitch.length > 0 &&
      afterSwitch.every((entry) => entry.auth === `Bearer ${ACCOUNT_B.token}`),
    `${afterSwitch.length} requests`,
  );
  await shot(page, "account-b-1440");

  step("switch back to account A");
  await switchAccount(page, w, ACCOUNT_A);
  if ((await mainDialog(page).count()) === 0) {
    await openAccessByKeyboard(page);
  }
  await mainDialog(page).getByText(uncertainRestored).waitFor(SLOW);
  check("account A's unconfirmed change returns with A", true);
  check("account switches send nothing", noNewMutations(w, beforeSwitch));

  const all = w.since(0, "mutation");
  check(
    "journey total: one mutation, no DELETE",
    all.length === 1 && all[0].method === "POST",
    describeMutations(all),
  );
  await context.close();
}

/**
 * An ordinary manager: no global permission, grant authority only through an
 * affiliated role on this dataset. The global-permission cases above are the
 * control.
 */
async function datasetContextManager() {
  const w = world({ globalPermissions: [], datasetActionPermissions: [GRANT] });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  step("open from details");
  await openDetails(page);
  await openAccessByKeyboard(page);
  const dialog = mainDialog(page);
  const group = dialog.getByLabel("Group", { exact: true });
  await group.waitFor(SLOW);
  const capabilityReads = w.since(0, "capability-read").map((e) => e.path);
  check(
    "global permissions read as empty and the dataset projection read",
    capabilityReads.includes("/principal/me?f=permissions") &&
      capabilityReads.some((path) =>
        path.startsWith(`/dataset/${DATASET.id}?`),
      ),
    capabilityReads.join(", "),
  );
  check(
    "grant-only presentation with existing access unavailable",
    (await dialog.getByRole("heading", { name: "Grant access" }).isVisible()) &&
      (await dialog
        .getByText("your account can't view existing permissions", {
          exact: false,
        })
        .isVisible()),
  );
  check("no switches", (await dialog.getByRole("switch").count()) === 0);
  check("no recipient-grant lookup", w.since(0, "recipient-read").length === 0);

  step("one deliberate grant");
  await group.selectOption(RESEARCH.id);
  await dialog.getByRole("radio", { name: "Download" }).check();
  check(
    "nothing sent before Grant access",
    w.since(0, "mutation").length === 0,
  );
  await dialog.getByRole("button", { name: "Grant access" }).click();
  await dialog
    .getByText(`Download permission granted to ${RESEARCH.name}.`)
    .waitFor(SLOW);
  const all = w.since(0, "mutation");
  check(
    "exactly one POST for this dataset, Research Team and Download",
    all.length === 1 &&
      all[0].method === "POST" &&
      all[0].path ===
        `/principal/context-grants/group/${RESEARCH.id}/dataset/${DATASET.id}/role/dg_ds-download` &&
      all[0].auth === `Bearer ${ACCOUNT_A.token}`,
    describeMutations(all),
  );
  check(
    "still no recipient-grant lookup",
    w.since(0, "recipient-read").length === 0,
  );
  await shot(page, "dataset-context-manager-1440");
  await context.close();
}

async function grantOnlyEveryone() {
  const w = world({ globalPermissions: GRANT_ONLY });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  step("open grant-only");
  await openDetails(page);
  await openAccessByKeyboard(page);
  const dialog = mainDialog(page);
  const group = dialog.getByLabel("Group", { exact: true });
  await group.waitFor(SLOW);
  check(
    "existing access is stated as unavailable",
    await dialog
      .getByText(
        "You can grant access, but your account can't view existing permissions.",
        { exact: false },
      )
      .isVisible(),
  );
  check(
    "no switches in grant-only",
    (await dialog.getByRole("switch").count()) === 0,
  );
  check(
    "no recipient reads in grant-only",
    w.since(0, "recipient-read").length === 0,
  );

  step("Everyone confirmation");
  await group.selectOption(EVERYONE.id);
  await dialog.getByRole("radio", { name: "Browse" }).check();
  await dialog.getByRole("button", { name: "Grant access" }).click();
  const confirm = page.getByRole("dialog", {
    name: "Grant access to all DataGEMS users?",
  });
  await confirm.waitFor(SLOW);
  check(
    "confirmation names the audience and excludes downloads",
    await confirm
      .getByText("This doesn't include downloading files.", { exact: false })
      .isVisible(),
  );
  check("nothing sent before confirming", w.since(0, "mutation").length === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(
    "Escape closes only the confirmation",
    (await confirm.count()) === 0 && (await dialog.isVisible()),
  );
  check("cancel sends nothing", w.since(0, "mutation").length === 0);
  await dialog.getByRole("button", { name: "Grant access" }).click();
  await confirm.getByRole("button", { name: "Grant Browse" }).click();
  await dialog
    .getByText(`Browse permission granted to ${EVERYONE.name}.`)
    .waitFor(SLOW);
  const all = w.since(0, "mutation");
  check(
    "exactly one Browse POST to the identified Everyone group",
    all.length === 1 &&
      all[0].method === "POST" &&
      all[0].group === EVERYONE.id &&
      all[0].role === "dg_ds-browse",
    describeMutations(all),
  );
  await shot(page, "grant-only-acknowledged-1440");
  await context.close();
}

async function ambiguousEveryone() {
  step("full editor");
  let w = world({ groups: AMBIGUOUS_GROUPS });
  let { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  await openDetails(page);
  await openAccessByKeyboard(page);
  await roleSwitch(page, RESEARCH, "Browse").waitFor(SLOW);
  const dialog = mainDialog(page);
  check(
    "two candidates marked as needing checks",
    (await dialog
      .getByText("Group needs checking", { exact: true })
      .count()) === 2,
  );
  check(
    "ambiguity explained",
    await dialog
      .getByText("Access to all DataGEMS users is unavailable.", {
        exact: false,
      })
      .isVisible(),
  );
  let blocked = true;
  for (const group of [PUBLIC_A, PUBLIC_B]) {
    for (const role of ROLE_LABELS) {
      if (!(await roleSwitch(page, group, role).isDisabled())) blocked = false;
    }
  }
  check("every switch for both candidates is disabled", blocked);
  await roleSwitch(page, RESEARCH, "Search").click();
  await dialog.getByText("Search permission granted.").waitFor(SLOW);
  const writes = w.since(0, "mutation");
  check(
    "ordinary group still usable: one POST to Research Team",
    writes.length === 1 && writes[0].group === RESEARCH.id,
    describeMutations(writes),
  );
  await context.close();

  step("grant-only");
  w = world({ groups: AMBIGUOUS_GROUPS, globalPermissions: GRANT_ONLY });
  ({ context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  }));
  await openDetails(page);
  await openAccessByKeyboard(page);
  const select = mainDialog(page).getByLabel("Group", { exact: true });
  await select.waitFor(SLOW);
  const disabled = await select.evaluate(
    (element, ids) =>
      ids.map(
        (id) =>
          element.querySelector(`option[value="${id}"]`)?.disabled === true,
      ),
    [PUBLIC_A.id, PUBLIC_B.id],
  );
  check("candidates cannot be chosen", disabled.every(Boolean));
  check(
    "chooser explains why",
    await mainDialog(page)
      .getByText("can't be chosen", { exact: false })
      .isVisible(),
  );
  check("nothing sent", w.since(0, "mutation").length === 0);
  await context.close();
}

async function readOnlyAndUnavailable() {
  const cases = [
    {
      name: "read-only",
      options: {
        globalPermissions: READ_ONLY,
        grants: { [RESEARCH.id]: ["dg_ds-browse"] },
      },
      ready: (page) => roleSwitch(page, RESEARCH, "Browse"),
    },
    {
      name: "recipient read fails",
      options: { recipientReadStatus: 500 },
      ready: (page) =>
        mainDialog(page).getByText("We couldn't load existing permissions.", {
          exact: false,
        }),
    },
    {
      name: "no grant capability",
      options: { globalPermissions: [] },
      ready: (page) =>
        mainDialog(page).getByText(
          "Access settings aren't available for your account.",
          { exact: false },
        ),
    },
  ];
  for (const { name, options, ready } of cases) {
    step(name);
    const w = world(options);
    const { context, page } = await openContext(browser, w, {
      baseUrl,
      viewport: DESKTOP,
    });
    await openDetails(page);
    await openAccessByKeyboard(page);
    await ready(page).waitFor(SLOW);
    await page.waitForTimeout(600);
    const dialog = mainDialog(page);
    const switches = dialog.getByRole("switch");
    const hasGrantForm =
      (await dialog.getByLabel("Group", { exact: true }).count()) > 0;
    if (name === "read-only") {
      const count = await switches.count();
      let allDisabled = count > 0;
      for (let index = 0; index < count; index += 1) {
        if (!(await switches.nth(index).isDisabled())) allDisabled = false;
      }
      check(
        `${name}: known assignment shown`,
        (await ready(page).getAttribute("aria-checked")) === "true",
      );
      check(
        `${name}: all ${count} switches disabled, no grant form`,
        allDisabled && !hasGrantForm,
      );
    } else {
      check(
        `${name}: no switches and no grant form (no downgrade)`,
        (await switches.count()) === 0 && !hasGrantForm,
      );
    }
    if (name === "no grant capability") {
      check(
        `${name}: no recipient reads`,
        w.since(0, "recipient-read").length === 0,
      );
    }
    check(`${name}: nothing sent`, w.since(0, "mutation").length === 0);
    await context.close();
  }
}

async function settingsEntry() {
  const w = world({ grants: { [RESEARCH.id]: ["dg_ds-browse"] } });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  step("keyboard open from settings");
  await page.goto(`${baseUrl}/settings?tab=roles`);
  const launcher = settingsLauncher(page);
  await launcher.waitFor(SLOW);
  await launcher.focus();
  await page.keyboard.press("Enter");
  await roleSwitch(page, RESEARCH, "Browse").waitFor(SLOW);
  check(
    "settings opens the same shared full editor",
    (await mainDialog(page).getByRole("switch").count()) === 18,
  );
  check("dialog takes focus", await focusInside(mainDialog(page)));
  await page.keyboard.press("Escape");
  await mainDialog(page).waitFor({ state: "detached", timeout: 10_000 });
  check(
    "Escape restores focus to the settings launcher",
    await launcher.evaluate((el) => el === document.activeElement),
    await describeFocus(page),
  );
  step("pointer open from settings");
  await launcher.click();
  await roleSwitch(page, RESEARCH, "Browse").waitFor(SLOW);
  await page.getByRole("button", { name: "Done" }).click();
  await mainDialog(page).waitFor({ state: "detached", timeout: 10_000 });
  check(
    "Done restores focus to the settings launcher",
    await launcher.evaluate((el) => el === document.activeElement),
    await describeFocus(page),
  );
  check("nothing sent", w.since(0, "mutation").length === 0);
  await context.close();
}

async function flagOff() {
  const w = world({ flag: false });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: DESKTOP,
  });
  step("details");
  await openDetails(page);
  await page.getByRole("button", { name: "Manage", exact: true }).waitFor(SLOW);
  check("legacy Manage entry present", true);
  check("no Manage access entry", (await detailsLauncher(page).count()) === 0);
  step("settings");
  await page.goto(`${baseUrl}/settings?tab=roles`);
  await page
    .getByRole("row")
    .filter({ hasText: DATASET.name })
    .first()
    .waitFor(SLOW);
  check(
    "no settings access launcher",
    (await settingsLauncher(page).count()) === 0,
  );
  const newFlow = w.ledger.filter(
    (entry) =>
      entry.kind === "capability-read" ||
      entry.kind === "recipient-read" ||
      entry.kind === "mutation" ||
      (entry.kind === "groups" && entry.body.includes("semantics")),
  );
  check(
    "no new-flow capability, group-semantics, recipient or mutation requests",
    newFlow.length === 0,
    newFlow.map((entry) => entry.path).join(", "),
  );
  await context.close();
}

async function narrowLayout() {
  step("full editor at 390");
  let w = world({ grants: { [RESEARCH.id]: ["dg_ds-browse"] } });
  let { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: NARROW,
  });
  await openDetails(page);
  const launcherFits = await withinViewportWidth(page, detailsLauncher(page));
  check(
    "Manage access launcher within viewport",
    launcherFits.ok,
    launcherFits.detail,
  );
  await openAccessByKeyboard(page);
  await roleSwitch(page, MARINE, "Search").waitFor(SLOW);
  const dialog = mainDialog(page);
  const fits = await withinViewportWidth(page, dialog);
  check("dialog within viewport width", fits.ok, fits.detail);
  check(
    "dialog has no internal horizontal overflow",
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  const last = roleSwitch(page, MARINE, "Search");
  let reached = false;
  for (let index = 0; index < 60 && !reached; index += 1) {
    await page.keyboard.press("Tab");
    reached = await last.evaluate((el) => el === document.activeElement);
  }
  const box = await last.boundingBox();
  check(
    "Tab reaches the last switch and it is scrolled into view",
    reached &&
      box !== null &&
      box.y >= 0 &&
      box.y + box.height <= NARROW.height,
    box === null ? "no box" : `y=${Math.round(box.y)}`,
  );
  check("focus stays in dialog at 390", await focusInside(dialog));
  await shot(page, "full-editor-390");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 10_000 });
  check(
    "Escape restores the launcher at 390",
    await detailsLauncher(page).evaluate((el) => el === document.activeElement),
  );
  await context.close();

  step("grant-only at 390");
  w = world({ globalPermissions: GRANT_ONLY });
  ({ context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: NARROW,
  }));
  await openDetails(page);
  await openAccessByKeyboard(page);
  const submit = mainDialog(page).getByRole("button", { name: "Grant access" });
  await submit.waitFor(SLOW);
  for (const [label, locator] of [
    ["group chooser", mainDialog(page).getByLabel("Group", { exact: true })],
    ["Grant access button", submit],
  ]) {
    const fit = await withinViewportWidth(page, locator);
    check(`${label} within viewport width`, fit.ok, fit.detail);
  }
  const lineHeight = await submit.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      line: Number.parseFloat(style.lineHeight) || 20,
    };
  });
  check(
    "Grant access label stays on one line",
    lineHeight.height < lineHeight.line * 2 + 16,
    JSON.stringify(lineHeight),
  );
  await shot(page, "grant-only-390");
  check("nothing sent at 390", w.since(0, "mutation").length === 0);
  await context.close();
}

// ---------------------------------------------------------------------------
// Task 4.6: caption, audience badge, local busy and acknowledgement styling.

/** A name long enough to wrap in the full editor at both widths. */
const LONG = {
  id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
  name: "North Atlantic Coastal Salinity and Temperature Harmonisation Working Group",
  semantics: [],
};
const PRESENTATION_GROUPS = [EVERYONE, RESEARCH, MARINE, LONG];
/** `text-gray-650`, the secondary-text token. */
const MUTED_GREY = "rgb(91, 112, 143)";

const rowOf = (page, group) =>
  roleSwitch(page, group, "Browse").locator("xpath=ancestor::li[1]");

/**
 * Records, from now on, any *visible* pending or busy sentence in the dialog.
 * A MutationObserver sees every committed DOM state, including one replaced
 * before the next paint, so a fast reply cannot hide a flash from it.
 */
const watchVisiblePending = (page) =>
  page.evaluate(() => {
    const seen = [];
    const scan = () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog === null) return;
      const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (!/Granting|Removing|Applying change/.test(text)) continue;
        const box = node.parentElement?.getBoundingClientRect();
        if (box && box.width > 1 && box.height > 1) seen.push(text.trim());
      }
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    window.__dgPendingSeen = seen;
    window.__dgPendingStop = () => observer.disconnect();
  });
const stopWatching = (page) =>
  page.evaluate(() => {
    window.__dgPendingStop?.();
    return window.__dgPendingSeen ?? [];
  });

/** Geometry of the caption, column headings, Everyone row and long row. */
const presentationGeometry = (page) =>
  mainDialog(page).evaluate(
    (dialog, names) => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const caption = [...dialog.querySelectorAll("p")].find((p) =>
        p.textContent?.startsWith("Showing groups you can view."),
      );
      const columns = caption?.nextElementSibling;
      const nameSpan = (name) =>
        [...dialog.querySelectorAll("span")].find(
          (span) => span.textContent === name,
        );
      const badge = [...dialog.querySelectorAll("span")].find(
        (span) => span.textContent === "All DataGEMS users",
      );
      const firstSwitch = (name) =>
        dialog.querySelector(`[role="switch"][aria-label="${name} — Browse"]`);
      const columnsShown =
        columns !== undefined && getComputedStyle(columns).display !== "none";
      return {
        caption: box(caption),
        columns: columnsShown ? box(columns) : null,
        browseHeading: columnsShown ? box(columns.firstElementChild) : null,
        everyone: box(nameSpan(names.everyone)),
        badge: box(badge),
        badgeLineHeight: badge
          ? Number.parseFloat(getComputedStyle(badge).lineHeight)
          : null,
        long: box(nameSpan(names.long)),
        researchSwitch: box(firstSwitch(names.research)),
        longSwitch: box(firstSwitch(names.long)),
        everyoneSwitch: box(firstSwitch(names.everyone)),
      };
    },
    { everyone: EVERYONE.name, long: LONG.name, research: RESEARCH.name },
  );

async function presentationChecks(viewport) {
  const tag = `${viewport.width}`;
  const w = world({
    groups: PRESENTATION_GROUPS,
    grants: { [RESEARCH.id]: ["dg_ds-browse"] },
  });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport,
  });
  await openDetails(page);
  await openAccessByKeyboard(page);
  const dialog = mainDialog(page);
  await roleSwitch(page, LONG, "Browse").waitFor(SLOW);
  await page.waitForTimeout(600);

  step(`caption, Everyone badge and long name at ${tag}`);
  const g = await presentationGeometry(page);
  check(
    `${tag}: “Showing groups you can view.” is shown once`,
    (await dialog.getByText("Showing groups you can view.").count()) === 1 &&
      (await dialog
        .getByText("Other users or groups", { exact: false })
        .count()) === 0,
  );
  if (viewport.width >= 640) {
    check(
      `${tag}: caption sits above the permission column headings`,
      g.caption !== null &&
        g.columns !== null &&
        g.caption.bottom <= g.columns.top + 0.5,
      JSON.stringify({ caption: g.caption, columns: g.columns }),
    );
    check(
      `${tag}: Browse heading is centred over the Browse switches`,
      g.browseHeading !== null &&
        g.researchSwitch !== null &&
        Math.abs(
          (g.browseHeading.left + g.browseHeading.right) / 2 -
            (g.researchSwitch.left + g.researchSwitch.right) / 2,
        ) < 2,
      JSON.stringify({ heading: g.browseHeading, sw: g.researchSwitch }),
    );
    check(
      `${tag}: Everyone and its badge share a line`,
      g.everyone !== null &&
        g.badge !== null &&
        Math.abs(
          (g.everyone.top + g.everyone.bottom) / 2 -
            (g.badge.top + g.badge.bottom) / 2,
        ) < 3 &&
        g.badge.left > g.everyone.right,
      JSON.stringify({ name: g.everyone, badge: g.badge }),
    );
    check(
      `${tag}: long-named row keeps its switches in the columns`,
      g.longSwitch !== null &&
        g.researchSwitch !== null &&
        g.everyoneSwitch !== null &&
        Math.abs(g.longSwitch.left - g.researchSwitch.left) < 1 &&
        Math.abs(g.everyoneSwitch.left - g.researchSwitch.left) < 1,
      JSON.stringify({ long: g.longSwitch, research: g.researchSwitch }),
    );
  } else {
    check(
      `${tag}: Everyone and its badge share a line when they fit`,
      g.everyone !== null &&
        g.badge !== null &&
        Math.abs(
          (g.everyone.top + g.everyone.bottom) / 2 -
            (g.badge.top + g.badge.bottom) / 2,
        ) < 3,
      JSON.stringify({ name: g.everyone, badge: g.badge }),
    );
  }
  check(
    `${tag}: the badge stays on one line`,
    g.badge !== null &&
      g.badgeLineHeight !== null &&
      g.badge.bottom - g.badge.top < g.badgeLineHeight * 2,
    JSON.stringify(g.badge),
  );
  check(
    `${tag}: long name wraps within the dialog`,
    g.long !== null && g.long.bottom - g.long.top > 22,
    JSON.stringify(g.long),
  );
  check(
    `${tag}: dialog has no horizontal overflow`,
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );

  step(`fast success at ${tag}`);
  const beforeFast = w.mark();
  await watchVisiblePending(page);
  await roleSwitch(page, RESEARCH, "Search").click();
  const fastAck = dialog.getByText("Search permission granted.", {
    exact: true,
  });
  await fastAck.waitFor(SLOW);
  await page.waitForTimeout(400);
  const flashed = await stopWatching(page);
  check(
    `${tag}: fast reply shows no pending sentence or busy banner`,
    flashed.length === 0,
    flashed.join(" | "),
  );
  const ackStyle = await fastAck.evaluate((span) => {
    const item = span.parentElement;
    const icon = item?.querySelector("svg");
    const r = icon?.getBoundingClientRect();
    return {
      color: getComputedStyle(span).color,
      iconColor: icon ? getComputedStyle(icon).color : null,
      icon: r ? { w: r.width, h: r.height } : null,
    };
  });
  check(
    `${tag}: acknowledgement is muted grey with a visible check icon`,
    ackStyle.color === MUTED_GREY &&
      ackStyle.iconColor === MUTED_GREY &&
      ackStyle.icon !== null &&
      ackStyle.icon.w >= 14,
    JSON.stringify(ackStyle),
  );
  const fastWrites = w.since(beforeFast, "mutation");
  check(
    `${tag}: fast success sent exactly one POST (Research Team Search)`,
    fastWrites.length === 1 &&
      fastWrites[0].method === "POST" &&
      fastWrites[0].group === RESEARCH.id &&
      fastWrites[0].role === "dg_ds-search",
    describeMutations(fastWrites),
  );

  step(`held pending at ${tag}`);
  w.mutation = "hold";
  const edit = roleSwitch(page, MARINE, "Edit");
  const marineRow = rowOf(page, MARINE);
  const rowBefore = await marineRow.boundingBox();
  const beforeHeld = w.mark();
  await edit.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  const held = await edit.evaluate((el) => {
    const svg = el.querySelector("svg");
    const r = svg?.getBoundingClientRect();
    const describedBy = el.getAttribute("aria-describedby");
    return {
      focused: el === document.activeElement,
      busy: el.getAttribute("aria-busy"),
      ariaDisabled: el.getAttribute("aria-disabled"),
      opacity: getComputedStyle(el).opacity,
      spinner: r ? { w: r.width, h: r.height } : null,
      description: describedBy
        ? document.getElementById(describedBy)?.textContent
        : null,
    };
  });
  check(
    `${tag}: held switch is busy, focused, full strength, with a visible spinner`,
    held.focused &&
      held.busy === "true" &&
      held.ariaDisabled === "true" &&
      held.opacity === "1" &&
      held.spinner !== null &&
      held.spinner.w >= 8,
    JSON.stringify(held),
  );
  check(
    `${tag}: held switch is described as “Granting Edit…”`,
    held.description === "Granting Edit…",
    String(held.description),
  );
  check(
    `${tag}: held row keeps its height and shows no banner`,
    rowBefore !== null &&
      Math.abs((await marineRow.boundingBox()).height - rowBefore.height) < 1 &&
      (await dialog.getByText("Applying change", { exact: false }).count()) ===
        0,
  );
  check(
    `${tag}: no acknowledgement while the reply is held`,
    (await dialog.getByText("Edit permission granted.").count()) === 0,
  );
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await edit.click({ force: true });
  await page.waitForTimeout(400);
  const heldWrites = w.since(beforeHeld, "mutation");
  check(
    `${tag}: repeated Space, Enter and click send one POST (Marine Edit)`,
    heldWrites.length === 1 &&
      heldWrites[0].group === MARINE.id &&
      heldWrites[0].role === "dg_ds-edit",
    describeMutations(heldWrites),
  );
  check(
    `${tag}: other switches are disabled while one change is pending`,
    await roleSwitch(page, RESEARCH, "Edit").isDisabled(),
  );
  await shot(page, `pending-held-${tag}`, dialog);
  check(`${tag}: held reply released`, w.release(204) === 1);
  await dialog.getByText("Edit permission granted.").waitFor(SLOW);
  check(
    `${tag}: acknowledged after release, focus kept, not busy`,
    (await edit.getAttribute("aria-busy")) === null &&
      (await edit.evaluate((el) => el === document.activeElement)),
    await describeFocus(page),
  );

  step(`refusal at ${tag}`);
  w.mutation = "refuse";
  await roleSwitch(page, MARINE, "Search").click();
  const refusal = dialog.getByText("Search permission wasn't granted.");
  await refusal.waitFor(SLOW);
  const refusalColor = await refusal.evaluate(
    (span) => getComputedStyle(span).color,
  );
  check(
    `${tag}: refusal is distinct from the grey acknowledgement`,
    refusalColor !== MUTED_GREY,
    refusalColor,
  );

  step(`confirmed consequential grant at ${tag}`);
  w.mutation = "ok";
  const beforeEveryone = w.mark();
  await roleSwitch(page, EVERYONE, "Browse").click();
  const confirm = page.getByRole("dialog", {
    name: "Grant access to all DataGEMS users?",
  });
  await confirm.waitFor(SLOW);
  check(
    `${tag}: nothing sent before confirming Everyone Browse`,
    noNewMutations(w, beforeEveryone),
  );
  await confirm.getByRole("button", { name: "Grant Browse" }).click();
  await rowOf(page, EVERYONE)
    .getByText("Browse permission granted.")
    .waitFor(SLOW);
  const everyoneWrites = w.since(beforeEveryone, "mutation");
  check(
    `${tag}: one Browse POST to the identified Everyone group`,
    everyoneWrites.length === 1 &&
      everyoneWrites[0].method === "POST" &&
      everyoneWrites[0].group === EVERYONE.id &&
      everyoneWrites[0].role === "dg_ds-browse",
    describeMutations(everyoneWrites),
  );
  if (viewport.width >= 640) await shot(page, `outcomes-${tag}`, dialog);

  step(`retained uncertainty under search at ${tag}`);
  w.mutation = "lose";
  await roleSwitch(page, LONG, "Download").click();
  await rowOf(page, LONG)
    .getByText("Download: we couldn't confirm whether it was granted.", {
      exact: false,
    })
    .waitFor(SLOW);
  await dialog.getByRole("textbox", { name: "Search groups" }).fill("Research");
  await page.waitForTimeout(400);
  const summary = dialog
    .getByRole("status")
    .filter({ hasText: "We couldn't confirm one access change." });
  const summaryText =
    (await summary.count()) > 0 ? await summary.innerText() : "";
  check(
    `${tag}: search hides the row but the summary names the unconfirmed change`,
    (await roleSwitch(page, LONG, "Download").count()) === 0 &&
      summaryText.includes(LONG.name) &&
      summaryText.includes("we couldn't confirm whether it was granted"),
    summaryText.replace(/\s+/g, " "),
  );
  if (viewport.width < 640) await shot(page, `uncertain-search-${tag}`, dialog);

  const all = w.since(0, "mutation");
  check(
    `${tag}: scenario total is exactly five POSTs, no DELETE`,
    all.length === 5 && all.every((entry) => entry.method === "POST"),
    describeMutations(all),
  );
  await context.close();
}

async function grantOnlyFeedback() {
  step("grant-only held and acknowledged result at 390");
  const w = world({ globalPermissions: GRANT_ONLY, mutation: "hold" });
  const { context, page } = await openContext(browser, w, {
    baseUrl,
    viewport: NARROW,
  });
  await openDetails(page);
  await openAccessByKeyboard(page);
  const dialog = mainDialog(page);
  const group = dialog.getByLabel("Group", { exact: true });
  await group.waitFor(SLOW);
  await group.selectOption(RESEARCH.id);
  await dialog.getByRole("radio", { name: "Browse" }).check();
  const grant = dialog.getByRole("button", { name: "Grant access" });
  await grant.click();
  const pending = dialog.getByText(`Granting Browse to ${RESEARCH.name}…`);
  await pending.waitFor(SLOW);
  await grant.click({ force: true });
  await page.waitForTimeout(400);
  const results = dialog
    .getByRole("status")
    .filter({ hasText: "Your changes" });
  check(
    "grant-only: pending result is named in the live results region",
    (await results.count()) === 1 &&
      (await results.innerText()).includes(
        `Granting Browse to ${RESEARCH.name}…`,
      ) &&
      (await dialog.getByText("Applying change", { exact: false }).count()) ===
        0,
  );
  check(
    "grant-only: no acknowledgement while held",
    (await dialog
      .getByText(`Browse permission granted to ${RESEARCH.name}.`)
      .count()) === 0,
  );
  check("grant-only: held reply released", w.release(204) === 1);
  const ack = dialog.getByText(
    `Browse permission granted to ${RESEARCH.name}.`,
  );
  await ack.waitFor(SLOW);
  const color = await ack.evaluate((span) => getComputedStyle(span).color);
  check(
    "grant-only: acknowledgement uses the same muted grey",
    color === MUTED_GREY,
    color,
  );
  const all = w.since(0, "mutation");
  check(
    "grant-only: exactly one Browse POST to Research Team",
    all.length === 1 &&
      all[0].method === "POST" &&
      all[0].group === RESEARCH.id &&
      all[0].role === "dg_ds-browse",
    describeMutations(all),
  );
  await shot(page, "grant-only-acknowledged-390", dialog);
  await context.close();
}

// ---------------------------------------------------------------------------

async function main() {
  if (baseUrl) {
    baseUrl = loopbackOrigin(baseUrl);
  } else {
    const port = Number(process.env.DG_BROWSER_PORT ?? 3317);
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

  const scenarios = [
    ["sidebar evidence states", sidebarStates],
    ["details full editor", fullEditorJourney],
    ["lost response and account switch", lostResponseAndAccounts],
    ["dataset-context manager grant-only", datasetContextManager],
    ["grant-only and Everyone confirmation", grantOnlyEveryone],
    ["ambiguous Everyone", ambiguousEveryone],
    ["read-only and unavailable", readOnlyAndUnavailable],
    ["settings launcher", settingsEntry],
    ["flag off", flagOff],
    ["narrow layout", narrowLayout],
    ["presentation at 1440", () => presentationChecks(DESKTOP)],
    ["presentation at 390", () => presentationChecks(NARROW)],
    ["grant-only feedback", grantOnlyFeedback],
  ];
  // Optional comma-separated name fragments, for a focused rerun. The request
  // boundary checks always run.
  const only = (process.env.DG_BROWSER_ONLY ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const [name, run] of scenarios) {
    if (only.length === 0 || only.some((part) => name.includes(part))) {
      await report.scenario(name, run);
    }
  }

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
  writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report.results, null, 2),
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
