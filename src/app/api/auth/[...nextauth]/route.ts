/* eslint-disable */
// @ts-nocheck
const NextAuth = require("next-auth").default;
const KeycloakProvider = require("next-auth/providers/keycloak").default;
const pino = require("pino");

const logger = pino({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

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
          redirect_uri: `${appBaseUrl}/api/auth/callback/keycloak`,
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
      logger.info({ user, account, profile }, "SignIn callback");
      return true;
    },
    async redirect({ url, baseUrl }) {
      logger.debug({ url, baseUrl }, "Redirect callback");
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Allows relative callback URLs
      else if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      return baseUrl;
    },
    async session({ session, token, user }) {
      logger.debug({ session, token, user }, "Session callback");
      if (token) {
        session.accessToken = token.access_token;
        session.user = token.user || session.user;

        if (token.error) {
          logger.error({ error: token.error }, "Session error");
          (session as any).error = token.error;
        }
      }
      return session;
    },
    async jwt({ token, account, user, profile }) {
      logger.debug({ token, account, user, profile }, "JWT callback");
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.user = user;
        return token;
      }

      if (Date.now() < token.expires_at * 1000 - 30000) {
        return token;
      }

      logger.info(
        {
          expiresAt: new Date(token.expires_at * 1000),
          currentTime: new Date(),
        },
        "Access token expired, attempting refresh"
      );
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
    logger.debug({ url }, "Refreshing token");

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
      logger.error({ refreshedTokens }, "Token refresh failed");
      throw refreshedTokens;
    }

    logger.info("Token refresh successful");

    return {
      ...token,
      access_token: refreshedTokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
      refresh_token: refreshedTokens.refresh_token ?? token.refresh_token, // Fall back to old refresh token, but note that
      // many providers give a new refresh token when you use the old one
    };
  } catch (error) {
    logger.error({ error }, "Error refreshing access token");
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export { handler as GET, handler as POST };
