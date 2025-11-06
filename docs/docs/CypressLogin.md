# Cypress — Login flow and E2E test setup

This document focuses on the Cypress-specific parts of the authentication flow: how tests perform automated login, the workarounds required for cross-origin IdP interactions, and troubleshooting steps for flaky auth tests.

## Test environment challenges

- Cross-origin OIDC flows (Keycloak) set cookies on the IdP domain. Modern browsers enforce SameSite and third-party cookie rules that can break automated logins when running in a test runner.
- IdP pages may load scripts that throw client-side errors or perform behaviours (autofocus) that interfere with deterministic test runs.

To address these, the test-suite uses several pragmatic workarounds (only for test environments):

### Browser flags

The Cypress configuration adds Chromium flags when launching the browser in CI/local tests to relax SameSite and third-party cookie enforcement. These flags are defined in `cypress.config.ts` and are only applied to the Cypress-launched browser.

### Header rewriting

`cy.rewriteHeaders()` (defined in `cypress/support/commands.ts`) intercepts responses during tests and rewrites `Set-Cookie` headers so cookies include `SameSite=None; Secure` where necessary. This helps the browser accept cookies created by Keycloak during the cross-origin login flow.

### Cross-origin interactions with cy.origin()

When interacting with the Keycloak pages the tests run that interaction inside `cy.origin('<keycloak-host>', ...)` — this makes the cross-origin commands explicit and prevents Cypress from blocking those interactions.

### Stubbing problematic scripts

If the IdP loads auxiliary scripts that cause errors during tests (for example the `authChecker.js` module), tests stub those requests and return small, inert modules to avoid uncaught exceptions that would otherwise fail the test.

## Reusable helpers

The project provides a set of helpers to simplify login in E2E tests:

- `cy.rewriteHeaders()` — rewrites response `Set-Cookie` headers (see above).
- `cy.login(opts?)` — performs the full login flow (reads credentials from `cypress/fixtures/credentials.json` or environment variables). The command:
  - calls `cy.rewriteHeaders()`
  - clears cookies and local storage
  - visits the app root and clicks the Sign in control
  - performs cross-origin IdP interactions using `cy.origin()` and submits username/password
  - waits for redirect back to `/dashboard` and asserts presence of a dashboard-specific UI element

The `cy.login()` command is intended for tests that need to start in an authenticated state. There is also a global `beforeEach` in `cypress/support/e2e.ts` which calls `cy.login()` by default; this can be disabled by running Cypress with `AUTO_LOGIN=false`.

## Example pseudo-flow used by tests

```js
cy.rewriteHeaders();
cy.clearCookies();
cy.clearLocalStorage();
cy.visit("/");
cy.contains("Sign in").click();
cy.origin("https://<keycloak-host>", { args: creds }, (creds) => {
  cy.get('input[name="username"]').type(creds.username);
  cy.get('input[name="password"]').type(creds.password, { log: false });
  cy.get('button[type="submit"]').click();
});
cy.url().should("include", "/dashboard");
cy.contains("Add Dataset").should("be.visible");
```

## Credentials for tests

- Use `cypress/fixtures/credentials.json` (do not commit sensitive values to the repo). Example fixture shape:

```json
{
  "username": "<username>",
  "password": "<password>"
}
```

- Or provide `CYPRESS_USERNAME` and `CYPRESS_PASSWORD` environment variables in CI.

## Troubleshooting

- If cookies are rejected by the browser, ensure the Cypress browser is launched with the SameSite/third-party cookie flags (see `cypress.config.ts`).
- If cross-origin actions fail, make sure interactions on the IdP domain are wrapped in `cy.origin()`.
- If benign IdP exceptions appear, add targeted ignores within the `cy.origin()` handler (the dashboard test provides examples).
- If `cy.task` helpers that open files (editor integration) fail with `code ENOENT`, verify the `code` CLI is present in PATH.

## References and examples in this repo

- `cypress/support/commands.ts` — `cy.rewriteHeaders()` and `cy.login()` implementation.
- `cypress/support/e2e.ts` — global `beforeEach` that calls `cy.login()` by default.
- `cypress/e2e/dashboard.cy.ts` — full fixture-based login example using `cy.origin()`.

---

This file is part of the automated tests documentation. For general authentication flow (NextAuth + Keycloak) see `../login.md`.
