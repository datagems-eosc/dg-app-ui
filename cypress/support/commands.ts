/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

// Custom command to rewrite Set-Cookie headers so cookies work inside Cypress' iframe/automation
// This addresses the SameSite/Lax blocking seen when an IdP replies with cookies without
// `SameSite=None; Secure` (common during cross-origin OIDC flows). Call `cy.rewriteHeaders()`
// in a `beforeEach` or at the start of a test to enable the interception.
Cypress.Commands.add("rewriteHeaders", () => {
  // Intercept all requests and rewrite Set-Cookie headers on the response
  cy.intercept("*", (req) => {
    req.on("response", (res) => {
      try {
        const setCookies = (res.headers as Record<string, any>)["set-cookie"];
        if (!setCookies) return;

        const cookieArray = Array.isArray(setCookies)
          ? setCookies
          : [setCookies];

        const rewritten = cookieArray
          .filter(Boolean)
          .map((headerContent: string) =>
            // Ensure we add Secure and set SameSite=None when a cookie has SameSite=Lax/Strict or no SameSite
            headerContent
              // replace any explicit SameSite=Lax or SameSite=Strict
              .replace(/samesite=(lax|strict)/gi, "SameSite=None; Secure")
              // If no SameSite specified, append SameSite=None; Secure
              .replace(/(?<!samesite=)(;?\s*)$/i, (m) =>
                headerContent.toLowerCase().includes("samesite=")
                  ? m
                  : `${m}; SameSite=None; Secure`,
              ),
          );

        // Set the rewritten headers back on the response
        (res.headers as Record<string, any>)["set-cookie"] = rewritten;
      } catch (e) {
        // Swallow errors — interception is best-effort
        // eslint-disable-next-line no-console
        console.warn("rewriteHeaders interception failed", e);
      }
    });
  });
});

// Add TypeScript definition for the custom command
declare global {
  namespace Cypress {
    interface Chainable {
      rewriteHeaders(): Chainable<void>;
      /**
       * Performs a full Keycloak login flow using credentials from
       * - `cypress/fixtures/credentials.json` OR
       * - environment variables `CYPRESS_USERNAME` / `CYPRESS_PASSWORD`
       *
       * The command will:
       * - call `cy.rewriteHeaders()` to make IdP cookies usable in Cypress
       * - clear cookies/localStorage
       * - visit the app root (uses `Cypress.config('baseUrl')`)
       * - perform the cross-origin Keycloak username/password submission
       */
      login(opts?: {
        keycloakOrigin?: string;
        visitPath?: string;
      }): Chainable<void>;
    }
  }
}

export {};

// Implement a reusable login command that mirrors the real login flow used in tests.
Cypress.Commands.add("login", (opts = {}) => {
  const baseUrl = Cypress.config("baseUrl") || "";
  const visitPath = opts.visitPath || "/";
  const keycloakOrigin =
    opts.keycloakOrigin ||
    Cypress.env("KEYCLOAK_ORIGIN") ||
    "https://datagems-dev.scayle.es";

  // Ensure header rewriting is active so Set-Cookie from the IdP is applied
  cy.rewriteHeaders();

  // Load credentials from fixture or env vars
  cy.fixture("credentials").then((creds: any) => {
    const username =
      creds?.username ||
      Cypress.env("USERNAME") ||
      Cypress.env("CYPRESS_USERNAME");
    const password =
      creds?.password ||
      Cypress.env("PASSWORD") ||
      Cypress.env("CYPRESS_PASSWORD");

    if (!username || !password) {
      throw new Error(
        "No credentials found for cy.login(): add cypress/fixtures/credentials.json or set CYPRESS_USERNAME/CYPRESS_PASSWORD env vars.",
      );
    }

    // Clean state before login
    cy.clearCookies();
    cy.clearLocalStorage();

    // Visit the application root (use baseUrl) so the Sign in button is available
    cy.visit(
      visitPath.startsWith("http") ? visitPath : `${baseUrl}${visitPath}`,
    );
    cy.contains(/Sign in to DataGEMS/i, { timeout: 10000 }).should(
      "be.visible",
    );

    // Stub the external authChecker script (matches existing test pattern)
    cy.intercept("GET", `${keycloakOrigin}/oauth/resources/**/authChecker.js`, {
      statusCode: 200,
      headers: { "content-type": "application/javascript" },
      body: "export function checkCookiesAndSetTimer(){ return; }",
    }).as("stubAuthChecker");

    // Trigger the Keycloak flow
    cy.contains("button", /Sign in/i).click();

    // Perform the cross-origin actions on the IdP page
    cy.origin(keycloakOrigin, { args: { username, password } }, (args) => {
      const { username: u, password: p } = args as any;

      // Ignore known benign uncaught exceptions coming from the IdP scripts
      cy.on("uncaught:exception", (err) => {
        const msg = typeof err?.message === "string" ? err.message : "";
        if (
          msg.includes("checkCookiesAndSetTimer") ||
          msg.includes("does not provide an export named") ||
          msg.includes("authChecker.js") ||
          msg.includes("Blocked autofocusing on a <input> element")
        ) {
          return false;
        }
        return true;
      });

      // Wait for the provider login UI and interact with it using resilient selectors
      cy.contains(/Or sign in with/i, { timeout: 20000 })
        .should("be.visible")
        .click();

      cy.get(
        'input[placeholder="Username or email"], input[name="username"], input#username',
        { timeout: 20000 },
      )
        .should("be.visible")
        .type(u);

      cy.get(
        'input[placeholder="Password"], input[name="password"], input#password',
        { timeout: 20000 },
      )
        .should("be.visible")
        .type(p, { log: false });

      cy.get(
        'input#kc-login, input[name="login"], input[value="Sign In"], button[type="submit"]',
        { timeout: 10000 },
      )
        .first()
        .click();
    });

    // After returning from cy.origin the app should redirect back to dashboard
    cy.url({ timeout: 30000 }).should("include", "/dashboard");
    cy.contains(/Add Dataset/i, { timeout: 10000 }).should("be.visible");
  });
});
