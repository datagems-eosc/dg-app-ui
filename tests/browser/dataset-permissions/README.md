# Dataset permissions browser journey

A repeatable local check of the dataset group access flow in the real Next.js application. The session, runtime configuration and every Gateway response are synthetic. No real account, dataset or permission is read or changed.

## Run it

```bash
pnpm install        # if dependencies are not installed yet
pnpm run test:browser:dataset-permissions
```

The command:

1. runs the no-network boundary checks in `boundaries.test.mjs` (exact-origin allow/reject), and stops if any fails;
2. starts its own `next dev --turbopack` on `127.0.0.1:3317`, and stops it at the end;
3. drives Google Chrome through the installed Playwright driver, headless;
4. prints one `PASS`/`FAIL` line per check, then the total. It exits 0 only when every check passes.

A run takes a few minutes, most of it for the first compile of each route.

### Prerequisites

- Dependencies installed, including the `playwright` dev dependency.
- Google Chrome installed; the run uses Playwright's `chrome` channel. To use a Playwright-managed Chromium instead, set `DG_BROWSER_CHANNEL=bundled`. That browser must already be installed for the Playwright version in the lockfile; this command never installs a browser.
- Port 3317 free. If it is in use, the run stops without touching whatever holds it.

No `.env.local`, account or network access is needed.

### Options

| Variable | Effect |
|---|---|
| `DG_BROWSER_PORT` | Port for the server this run starts (default `3317`). |
| `DG_BROWSER_BASE_URL` | Use a server you are already running instead, e.g. `http://127.0.0.1:3400`. Only a bare loopback `http` origin is accepted (no path, query or credentials). The run does not start or stop anything. |
| `DG_BROWSER_OUT` | Output folder. Default: a new temporary folder, printed at the start. |
| `DG_BROWSER_CHANNEL` | Playwright browser channel (default `chrome`; `bundled` for Playwright's Chromium). |
| `DG_BROWSER_HEADED=1` | Show the browser. |

The output folder holds screenshots of the inspected states, `results.json` and, when the run started the server, `next-dev.log`. Do not commit it.

## Request boundaries

- Routing compares parsed exact origins (scheme, host and port), never string prefixes. A lookalike host or another port is escaped.
- Requests to the local server reach the application, except `/__env.js` and `/api/auth/*`. Those return a synthetic configuration and session. The configured Gateway is `https://gateway.synthetic.invalid`, under `/gw/api/`.
- The Gateway stub answers only the routes these pages are known to call. Any other Gateway route is recorded as unexpected and fails the run.
- A request to any other origin is aborted, recorded as escaped and fails the run.
- The feature flag is set only in each isolated browser context's storage.

Write counts are exact. Read counts are checked as present, absent or limited to the right groups, because the development server's React Strict Mode may issue a read twice.

## What the journey checks

Desktop is 1440×900. The narrow checks use 390×844.

- **Sidebar**: “Your permissions”, with the caller's chips when known, “No permissions shown” for a successful empty read, and “Permissions unavailable” when the details carry no permission evidence. Each state excludes the other two, at both widths.
- **Details entry, full editor**: keyboard open, focus inside the dialog for 30 Tab and 10 Shift+Tab presses, 3 groups × 6 switches, and the known assignment shown.
- **One deliberate grant**: exactly one `POST` for the chosen group and role, sent with account A's token. While it is pending, the switch keeps focus and is `aria-disabled`, and Space, Enter and a click send nothing more. After the response, the result is named and the group is read again.
- **Nested confirmation**: Enter on Manage opens a confirmation that holds focus. One Escape closes only the confirmation, returns focus to the switch, keeps the page scroll-locked and sends nothing. Escape or Done then closes the dialog and returns focus to “Manage access”.
- **Refresh and reopen**: the acknowledged grant is read back and nothing is sent.
- **Lost response**: the connection drops after dispatch. The change is shown as unconfirmed, the switch is held and Space, Enter and a click send nothing: no retry and no removal. The unconfirmed change is still shown after closing and reopening, and after a page refresh.
- **Account switch**: with the dialog open, the session changes to account B. B sees none of A's unconfirmed changes, the switch is usable again, and every later Gateway request carries B's token. Switching back shows A's unconfirmed change again. Nothing is sent.
- **Dataset-context manager**: global permissions read successfully as empty, and the dataset permission projection grants `AddUserToContextGrantGroup`. The grant-only presentation appears, no recipient-grant lookup is made, and one deliberate grant sends exactly one `POST` for the dataset, Research Team and Download. The global-permission grant-only case below is the control.
- **Grant-only**: existing access is stated as unavailable, with no switches and no recipient reads. Choosing Everyone and Browse opens the all-users confirmation, which excludes downloads. Escape closes only the confirmation, and cancelling sends nothing. Confirming sends one `POST` to the identified Everyone group.
- **Ambiguous Everyone**: with two groups marked as everyone, both are labelled as needing checks and all their switches are disabled; an ordinary group still accepts one grant. In grant-only, both options are disabled and explained.
- **Read-only and unavailable**: lookup without write permissions shows disabled switches. A failed recipient read and a caller with no grant capability show an explanation, with no switches and no grant form (no downgrade to grant-only). Nothing is sent.
- **Settings entry**: the “Manage access to …” button opens the same full editor by keyboard and pointer. Escape and Done return focus to that button.
- **Flag off**: the legacy details Manage button remains, there is no new entry on either page, and no capability, group-semantics, recipient or write request is sent.
- **390 px**: the launcher, dialog, group chooser and Grant access button fit the width. The dialog has no horizontal overflow, Tab reaches the last switch and scrolls it into view, Escape restores the launcher, and the Grant access label stays on one line.

## What it does not prove

- Gateway authorization, the deployed contract or the effect on real recipients. Those need the authorized real-account smoke (task 4.3).
- Production-build behaviour: this runs the development server.
- That the flow is ready to enable. The flag stays off by default everywhere.
- CI coverage: this journey is local only. CI runs the Vitest selection `pnpm run test:dataset-permissions`.
