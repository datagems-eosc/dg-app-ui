/* eslint-disable */
// @ts-nocheck
const NextAuth = require("next-auth").default;
const KeycloakProvider = require("next-auth/providers/keycloak").default;

// Use environment variables consistently
const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const fullBaseUrl = `${appBaseUrl}${basePath}`;

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = fullBaseUrl;
}

const handler = NextAuth({
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? "dg-app-ui",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      issuer:
        process.env.KEYCLOAK_ISSUER ??
        "https://datagems-dev.scayle.es/oauth/realms/dev",
      client: {
        token_endpoint_auth_method: "none", // PKCE public client
      },
      authorization: {
        params: {
          scope: "openid dg-app-api offline_access",
          pkce: true,
          redirect_uri: `${fullBaseUrl}/api/auth/callback/keycloak`,
        },
      },
      checks: ["pkce"],
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/api/auth/signin",
    signOut: "/api/auth/signout",
    error: "/api/auth/error",
    verifyRequest: "/api/auth/verify-request",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log("SignIn callback:", { user, account, profile });
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback:", { url, baseUrl });
      const basePathForRedirect = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const fullBaseUrlForRedirect = `${baseUrl}${basePathForRedirect}`;
      
      if (url.startsWith(fullBaseUrlForRedirect)) {
        return url;
      }
      
      if (url.startsWith("/")) {
        return `${fullBaseUrlForRedirect}${url}`;
      }
      
      if (url.startsWith(baseUrl)) {
        return url.replace(baseUrl, fullBaseUrlForRedirect);
      }
      
      return fullBaseUrlForRedirect;
    },
    async session({ session, token, user }) {
      console.log("Session callback:", { session, token, user });
      if (token) {
        session.accessToken = token.access_token;
        session.user = token.user || session.user;

        // Pass through token refresh errors to the client
        if (token.error) {
          console.error("Session error:", token.error);
          (session as any).error = token.error;
        }
      }
      return session;
    },
    async jwt({ token, account, user, profile }) {
      console.log("JWT callback:", { token, account, user, profile });

      // Initial sign in
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.user = user;
        return token;
      }

      // Return previous token if the access token has not expired yet
      // Add a 30-second buffer to refresh tokens before they expire
      if (Date.now() < token.expires_at * 1000 - 30000) {
        return token;
      }

      // Access token has expired, try to update it
      console.log("Access token expired, attempting refresh...");
      console.log("Token expires at:", new Date(token.expires_at * 1000));
      console.log("Current time:", new Date());
      return refreshAccessToken(token);
    },
  },
  debug: process.env.NODE_ENV === "development",
});

/**
 * Takes a token, and returns a new token with updated
 * `access_token` and `expires_at`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token) {
  try {
    const url = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
    console.log("Refreshing token at:", url);

    const response = await fetch(url, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens);
      throw refreshedTokens;
    }

    console.log("Token refresh successful");

    return {
      ...token,
      access_token: refreshedTokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
      refresh_token: refreshedTokens.refresh_token ?? token.refresh_token, // Fall back to old refresh token, but note that
      // many providers give a new refresh token when you use the old one
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export { handler as GET, handler as POST };
