# Login (technical overview)

This document describes the technical flow used by the frontend to authenticate users and how the test-suite performs automated login during end-to-end (E2E) runs. It targets developers and QA engineers who need to understand how authentication is wired, how session and tokens are transported, and how to troubleshoot login-related failures.

## Overview

The application uses NextAuth (Next.js) for session management and delegates authentication to an external OpenID Connect (OIDC) provider — Keycloak in the deployed environments. The high-level flow is:

1. User clicks the app "Sign in" control (client-side UI).
2. NextAuth initiates a redirect to the Keycloak authorization endpoint (the IdP).
3. The user authenticates on Keycloak (username/password, or other configured methods).
4. Keycloak issues authentication cookies and returns an authorization code to the app's callback URL.
5. NextAuth exchanges the authorization code for tokens (ID token, access token, optionally refresh token) on the server side.
6. NextAuth creates a session and sets the session cookie(s) for the app domain. The front-end reads session information via the `useSession()` hook.

On the client, the app accesses the current session with `useSession()` (NextAuth). Where required, the app reads an `accessToken` value that is attached to the NextAuth session (the project attaches the token via NextAuth callbacks so it is available to client code — see places where `session?.accessToken` is read).

## Running the login flow manually (developer notes)

If you need to reproduce the full login flow locally while developing or troubleshooting:

1. Ensure your browser can reach the Keycloak instance used by the environment (network/VPN may be required).
2. Start the app and open it in the browser.
3. Click the Sign in button and perform the credentials entry on the Keycloak page.
4. Verify the app receives the callback and the session is created (look for the NextAuth session cookie and the `accessToken` in `useSession()` usage sites).

## How the frontend reads and uses tokens

- The app reads the NextAuth session in React components using `useSession()`.
- Where an `accessToken` is required for API calls, the app retrieves it from the session (the project copies the token into the session object using NextAuth callbacks on the server side).
- API calls to the backend attach the access token in the `Authorization: Bearer <token>` header (see `src/lib/apiClient.ts`).

## Troubleshooting and common failures

If you need Cypress-specific guidance (automated login, cross-origin IdP handling, helper commands and troubleshooting for test runs) see the dedicated Cypress test documentation:

- `docs/docs/cypress/CypressLogin.md`

## Security note

The test-specific relaxations (browser flags, header rewriting) intentionally lower browser security to make tests feasible. These changes should never be applied in production or developer browsers used for general browsing.

## References in the codebase

- `src/lib/apiClient.ts` — where the frontend attaches the `Authorization` header for API calls.

---

If you'd like, I can also:

- Add a small `docs/docs/login-troubleshooting.md` with step-by-step debugging commands (Cypress logs, capturing network trace).
- Add `data-cy` attributes to search and dataset elements to make tests more robust (separate change).
