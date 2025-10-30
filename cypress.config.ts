import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Set a baseUrl matching your deployed frontend to simplify cy.visit() calls
    baseUrl: "https://datagems-frontend.idego.io",
    setupNodeEvents(on, config) {
      // Before the browser launches, add flags to disable third-party cookie blocking
      // so the Keycloak / external auth flow can set its cookies during tests.
      // This is necessary because modern Chrome blocks some third-party cookies
      // which breaks cross-origin OIDC flows used by NextAuth + Keycloak.
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.family === "chromium") {
          // Disable SameSite-by-default and third-party cookie blocking features.
          // Add several additional flags to relax cross-origin checks for the test browser.
          // NOTE: These reduce browser security and should only be used for local/CI test runs.
          // Disable enforcement of SameSite and Secure requirements so cookies set by
          // the IdP during cross-origin flows are accepted by the test browser.
          launchOptions.args.push(
            "--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,BlockThirdPartyCookies,ThirdPartyCookieBlocking"
          );

          // Disable site isolation and other strict network features that can interfere with
          // cross-origin OIDC flows in instrumentation environments.
          launchOptions.args.push("--disable-site-isolation-trials");

          // Disable web security to allow cross-origin interactions during tests (use cautiously).
          launchOptions.args.push("--disable-web-security");

          // Use an isolated user-data-dir for the Cypress browser so flags take effect and
          // the profile can be configured to allow third-party cookies if needed.
          // This directory will be created in the project root when the browser launches.
          const userDataDir = launchOptions.args.find((a) => a.startsWith('--user-data-dir')) ||
            `--user-data-dir=${process.cwd()}/.cypress_profile`;
          launchOptions.args.push(userDataDir);

          // Optional: allow insecure localhost if using http (uncomment if needed)
          // launchOptions.args.push('--ignore-certificate-errors');
        }

        return launchOptions;
      });

      return config;
    },
  },
});
