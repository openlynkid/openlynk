import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "@/env";
import {
  collectOrgMembershipFacts,
  deleteSoleMemberOrganizations,
  describeDeletionBlockers,
  evaluateDeletionBlockers,
} from "@/modules/account/deletion-guard";

// Determine dynamic base URL with priority for deployment environments
const getBetterAuthBaseURL = () => {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return env.BETTER_AUTH_URL;
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: getBetterAuthBaseURL(),
  trustedOrigins: [
    "http://localhost:3000",
    env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ].filter(Boolean) as string[],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    deleteUser: {
      enabled: true,
      /**
       * Refuse deletion while the account still anchors a shared workspace.
       * `order.userId` and `subscription.userId` cascade, so a payer deleting their
       * account would silently strip the plan from the other members.
       */
      beforeDelete: async (user) => {
        const facts = await collectOrgMembershipFacts(user.id);
        const blockers = evaluateDeletionBlockers(facts);
        if (blockers.length > 0) {
          throw APIError.from("BAD_REQUEST", {
            message: `Cannot delete this account: ${describeDeletionBlockers(blockers)}.`,
            code: "ACCOUNT_DELETION_BLOCKED",
          });
        }

        // Safe now: no shared workspace depends on this account. Without this, a
        // workspace only this user belonged to would be left behind with no members.
        await deleteSoleMemberOrganizations(facts);
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
