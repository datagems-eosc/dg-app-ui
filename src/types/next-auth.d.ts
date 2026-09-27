import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    /**
     * The existing `DefaultSession` fields are kept exactly as they are; the
     * only addition is an **optional** stable principal id.
     *
     * Source basis at the pinned revision: the installed Keycloak provider maps
     * `profile.sub` to `user.id`, the JWT callback stores `token.user = user`
     * and the session callback re-exposes it as `session.user`. That is a
     * source observation, not a runtime guarantee — which is why the property
     * is optional here and every consumer still checks it at runtime before
     * using it as an identity.
     */
    user?: DefaultSession["user"] & { id?: string };
  }
}
