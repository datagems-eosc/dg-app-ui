/* eslint-disable */
// @ts-nocheck
const NextAuth = require("next-auth").default;
const KeycloakProvider = require("next-auth/providers/keycloak").default;

// Use environment variables consistently
const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

// NEXTAUTH_URL is now set via environment variable in docker-compose.yml

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
          scope: "openid datasets dg-app-api",
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
      console.log("SignIn callback:", { user, account, profile });
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback:", { url, baseUrl });
      // Handle base path in redirects
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
      console.log("Session callback:", { session, token, user });
      if (token) {
        session.accessToken = token.access_token;
        session.user = token.user || session.user;
      }
      return session;
    },
    async jwt({ token, account, user, profile }) {
      console.log("JWT callback:", { token, account, user, profile });
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }
      if (user) {
        token.user = user;
      }
      return token;
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST }; 