// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Global beforeEach: ensure tests start from a clean cookie/storage state and optionally
// perform the app login so every test begins authenticated. Tests can opt-out by
// setting the Cypress env `AUTO_LOGIN` to `false` (for example: `CYPRESS_AUTO_LOGIN=false`).
const shouldAutoLogin =
  Cypress.env("AUTO_LOGIN") !== false && Cypress.env("AUTO_LOGIN") !== "false";

beforeEach(() => {
  // Always clean cookies and local storage at the start of each test
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.viewport(1200, 1000);
  if (!shouldAutoLogin) {
    // If auto-login disabled, stop here
    return;
  }

  // Perform a full login flow. The `cy.login()` command will read credentials from
  // `cypress/fixtures/credentials.json` or from `CYPRESS_USERNAME` / `CYPRESS_PASSWORD` env vars.
  cy.login();
});
