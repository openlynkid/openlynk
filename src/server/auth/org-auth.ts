import { db } from "@/server/db";
import { organization, member } from "@/server/db/schema/organizations";
import { eq, and } from "drizzle-orm";

export type OrgAuthResult =
  | {
      success: true;
      role: "owner" | "admin" | "member";
      organization: typeof organization.$inferSelect;
    }
  | {
      success: false;
      status: 400 | 403 | 404;
      error: string;
    };

/**
 * Validates that an organization exists and that the user is a member.
 * If requireBillingAccess is true, verifies that the user has 'owner' or 'admin' role.
 */
export async function verifyUserOrgMembership(
  userId: string,
  organizationId: string,
  options?: { requireBillingAccess?: boolean; dbClient?: typeof db }
): Promise<OrgAuthResult> {
  const client = options?.dbClient ?? db;
  if (typeof organizationId !== "string") {
    return { success: false, status: 400, error: "Invalid organization ID" };
  }

  const trimmedId = organizationId.trim();
  if (!trimmedId || trimmedId.length > 128) {
    return { success: false, status: 400, error: "Invalid organization ID" };
  }

  // 1. Verify organization exists
  const [org] = await client
    .select()
    .from(organization)
    .where(eq(organization.id, trimmedId))
    .limit(1);

  if (!org) {
    return { success: false, status: 404, error: "Organization not found" };
  }

  // 2. Verify user is a member of the organization
  const [membership] = await client
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, trimmedId),
        eq(member.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    return {
      success: false,
      status: 403,
      error: "Forbidden: You are not a member of this organization",
    };
  }

  // 3. Enforce billing management permission (checkout creation)
  if (options?.requireBillingAccess) {
    if (membership.role !== "owner" && membership.role !== "admin") {
      return {
        success: false,
        status: 403,
        error: "Forbidden: Only organization owners and admins can manage billing",
      };
    }
  }

  return {
    success: true,
    role: membership.role as "owner" | "admin" | "member",
    organization: org,
  };
}
