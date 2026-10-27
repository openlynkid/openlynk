export type OrganizationRole = "owner" | "admin" | "member";

export interface MemberSummary {
  /** The `member` row id, not the user id. */
  id: string;
  role: OrganizationRole;
}

export interface MemberManagementContext {
  /** Role the signed-in user holds in this organization. */
  viewerRole: OrganizationRole;
  /** The `member` row id of the signed-in user. */
  viewerMemberId: string;
  /** Active members only; pending invitations are not members yet. */
  members: MemberSummary[];
}

export interface MemberCapabilities {
  /** Roles this member can be moved to. Empty when no role change is allowed. */
  assignableRoles: OrganizationRole[];
  /** Whether the viewer may remove this member from the organization. */
  canRemove: boolean;
  /** True when the row is the viewer's own membership. */
  isSelf: boolean;
}

/**
 * Mirrors the guards better-auth's organization plugin applies server-side, so the UI
 * never offers an action the server will reject.
 *
 * Server rules this reflects:
 * - `member: ["delete"]` belongs to the owner and admin roles, so both may remove
 *   members, but only the creator role may remove another creator;
 * - `member: ["update"]` likewise, and granting the creator role requires holding it;
 * - the last remaining owner can never be demoted or removed, or the workspace would
 *   be left with nobody able to administer it.
 */
export function getMemberCapabilities(
  member: MemberSummary,
  context: MemberManagementContext
): MemberCapabilities {
  const { viewerRole, viewerMemberId, members } = context;
  const isSelf = member.id === viewerMemberId;
  const viewerIsOwner = viewerRole === "owner";
  const viewerCanManageMembers = viewerIsOwner || viewerRole === "admin";

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isLastOwner = member.role === "owner" && ownerCount <= 1;
  const targetIsOwner = member.role === "owner";

  // Granting the creator role requires holding it, so an admin may only move members
  // between the non-owner roles.
  const assignableRoles: OrganizationRole[] = [];
  if (!isLastOwner) {
    if (viewerIsOwner) {
      assignableRoles.push(
        ...(["owner", "admin", "member"] as const).filter((role) => role !== member.role)
      );
    } else if (viewerRole === "admin" && !targetIsOwner) {
      assignableRoles.push(
        ...(["admin", "member"] as const).filter((role) => role !== member.role)
      );
    }
  }

  const canRemove =
    viewerCanManageMembers &&
    !isSelf &&
    !isLastOwner &&
    // An admin may not remove an owner: the server requires the creator role for that.
    !(targetIsOwner && !viewerIsOwner);

  return { assignableRoles, canRemove, isSelf };
}

/** `invitation: ["cancel"]` belongs to the owner and admin roles. */
export function canManageInvitations(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export function describeRole(role: OrganizationRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
